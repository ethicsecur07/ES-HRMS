import mongoose from 'mongoose';
import { Attendance, IAttendance } from '../../../models/Attendance.js';
import { Employee } from '../../../models/Employee.js';
import { User } from '../../../models/User.js';
import { GeoFence } from '../../../models/AdvancedAttendanceEngine.js';
import { Shift } from '../../../models/Shift.js';
import { ShiftService } from './ShiftService.js';
import { createAuditLog } from '../../../services/auditLog.service.js';
import { getIO } from '../../../sockets/socketHandler.js';
import { LatePenaltyService } from '../../leave-engine/services/LatePenaltyService.js';
import { PermissionRequest } from '../../../models/PermissionRequest.js';
import { Leave } from '../../../models/Leave.js';
import { Organization } from '../../../models/Organization.js';

// Haversine formula helper
const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export class AttendanceService {
  /**
   * Retrieves today's attendance records for the tenant, restricted to the employee's own logs if requested.
   */
  static async getTodayAttendance(
    organizationId: string | mongoose.Types.ObjectId,
    userId?: string,
    role?: string,
    email?: string
  ): Promise<IAttendance[]> {
    const today = new Date().toISOString().split('T')[0];
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const query: any = { date: today, organizationId: orgId };

    if (role === 'EMPLOYEE' && userId && email) {
      const user = await User.findOne({ _id: userId, organizationId: orgId });
      let employeeId = user?.employeeId;
      if (user && !employeeId) {
        const employee = await Employee.findOne({ email, organizationId: orgId });
        if (employee) employeeId = employee._id;
      }
      if (employeeId) {
        await AttendanceService.checkAndProcessForgotCheckout(organizationId, employeeId, email);
        query.employeeId = employeeId;
      } else {
        return [];
      }
    }

    return Attendance.find(query).populate('employeeId');
  }

  /**
   * Retrieves all historical attendance records, restricted to the employee's own logs if requested.
   */
  static async getAllAttendance(
    organizationId: string | mongoose.Types.ObjectId,
    userId?: string,
    role?: string,
    email?: string
  ): Promise<IAttendance[]> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const query: any = { organizationId: orgId };

    if (role === 'EMPLOYEE' && userId && email) {
      const user = await User.findOne({ _id: userId, organizationId: orgId });
      let employeeId = user?.employeeId;
      if (user && !employeeId) {
        const employee = await Employee.findOne({ email, organizationId: orgId });
        if (employee) employeeId = employee._id;
      }
      if (employeeId) {
        await AttendanceService.checkAndProcessForgotCheckout(organizationId, employeeId, email);
        query.employeeId = employeeId;
      } else {
        return [];
      }
    }

    return Attendance.find(query).populate('employeeId').sort({ date: -1, loginTime: -1 });
  }

  /**
   * Logs a secure check-in. Validates tenant scope, IP whitelist, GPS geofences, and handles late marks.
   */
  static async checkIn(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string,
    email: string,
    ipAddress: string,
    deviceInfo: string,
    overrideReason?: string,
    lat?: number,
    lng?: number
  ): Promise<IAttendance> {
    const today = new Date().toISOString().split('T')[0];
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate employee exists in organization
      const employee = await Employee.findOne({ _id: empId, organizationId: orgId }).session(session);
      if (!employee) {
        throw new Error('Target employee not found in this organization.');
      }

      // 1.5 Enforce Approved Leave Block (Do not allow check-in on approved leave days)
      const approvedLeaveToday = await Leave.findOne({
        organizationId: orgId,
        employeeId: empId,
        leaveType: { $ne: 'WFH' }, // WFH is not a leave, they must check in
        status: 'APPROVED',
        startDate: { $lte: today },
        endDate: { $gte: today },
      }).session(session);

      if (approvedLeaveToday) {
        throw new Error(`Check-in blocked: You have an approved leave (${approvedLeaveToday.leaveType}) today. You cannot record attendance on approved leave days.`);
      }

      // 2. Prevent duplicate check-in
      const existing = await Attendance.findOne({ employeeId: empId, date: today, organizationId: orgId }).session(session);
      if (existing) {
        throw new Error('Attendance already recorded for today.');
      }

      // 3. Verify location (Office IP Range or GPS GeoFence)
      const isOfficeIP = ipAddress.includes('192.168.29.') || ipAddress === '127.0.0.1' || ipAddress === '::1';
      let withinGeoFence = false;
      let matchedFence = null;
      let distanceFromCenter = 0;

      if (lat !== undefined && lng !== undefined) {
        const fences = await GeoFence.find({ organizationId: orgId, isActive: true }).session(session);
        for (const fence of fences) {
          const dist = getDistanceInMeters(lat, lng, fence.latitude, fence.longitude);
          if (dist <= fence.radius) {
            withinGeoFence = true;
            matchedFence = fence;
            distanceFromCenter = Math.round(dist);
            break;
          }
        }
      }

      const locationVerified = isOfficeIP || withinGeoFence || !!overrideReason;
      const status = isOfficeIP ? 'OFFICE' : (withinGeoFence ? 'OFFICE' : 'WFH');
      let isLate = false;
      let lateReason = '';

      // 4. Resolve shift and evaluate late-in check
      const now = new Date();
      const resolvedShift = await ShiftService.getAssignedShiftForDate(orgId, empId, now);
      
      let shiftId: mongoose.Types.ObjectId | undefined = undefined;
      
      if (resolvedShift) {
        shiftId = resolvedShift._id as mongoose.Types.ObjectId;
        const [shiftHour, shiftMin] = resolvedShift.startTime.split(':').map(Number);
        const shiftStartToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMin, 0);
        // Add 15 minutes grace period
        const thresholdTime = new Date(shiftStartToday.getTime() + 15 * 60 * 1000);

        if (now > thresholdTime) {
          isLate = true;
          lateReason = 'Late check-in after shift grace period';
        }
      } else {
        // Fallback to legacy default 9:35 AM rule
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (currentHour > 9 || (currentHour === 9 && currentMinute > 35)) {
          isLate = true;
          lateReason = 'Late check-in after default 9:35 AM threshold';
        }
      }

      // 4b. Enforce Morning/Scheduled Permission Block
      const activePermissions = await PermissionRequest.find({
        organizationId: orgId,
        employeeId: empId,
        date: today,
        approvalStatus: { $ne: 'REJECTED' }
      }).session(session);

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      for (const perm of activePermissions) {
        const [startH, startM] = perm.startTime.split(':').map(Number);
        const [endH, endM] = perm.endTime.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;

        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          throw new Error(`Check-in blocked: You have a scheduled permission from ${perm.startTime} to ${perm.endTime} at this time. You cannot check in during your permission hours.`);
        }
      }

      // 4c. Enforce Late Check-In Salary-Cycle Limits:
      //   - 1st late in the cycle → allowed, warning returned in API response
      //   - 2nd late in the cycle → blocked, counted as absent (employee must apply for leave)
      if (isLate) {
        // Fetch org salary cycle start day (default 10 → cycle runs 10th to 9th)
        const org = await Organization.findOne({ _id: orgId })
          .session(session)
          .select('settings.salaryCycleStartDay');
        const startDay = org?.settings?.salaryCycleStartDay ?? 10;

        const { cycleStart, cycleEnd } = AttendanceService.getSalaryCycleDates(now, startDay);

        const priorLateCount = await Attendance.countDocuments({
          organizationId: orgId,
          employeeId: empId,
          isLate: true,
          date: { $gte: cycleStart, $lte: cycleEnd }
        }).session(session);

        // 2nd late in this salary cycle → block the check-in
        if (priorLateCount >= 1) {
          throw new Error(
            `Check-in blocked: This is your 2nd late check-in this salary cycle ` +
            `(${cycleStart} → ${cycleEnd}). Today will be counted as absent. ` +
            `Please apply for leave to cover this absence.`
          );
        }
        // priorLateCount === 0 → 1st late, allow with a warning (returned by controller)
      }

      // 5. Create Attendance record
      const geoFenceField = (lat !== undefined && lng !== undefined) ? {
        latitude: lat,
        longitude: lng,
        withinGeoFence,
        distanceFromCenter,
      } : undefined;

      const anomalyField = !locationVerified ? {
        isAnomaly: true,
        anomalyType: 'GEO_BREACH' as const,
        description: `Unverified check-in location (IP: ${ipAddress}, Coords: ${lat}, ${lng}).`,
        isResolved: false,
      } : undefined;

      const [attendance] = await Attendance.create(
        [
          {
            organizationId: orgId,
            employeeId: empId,
            date: today,
            loginTime: now,
            ipAddress,
            deviceInfo,
            status,
            isLate,
            locationVerified,
            overrideReason: lateReason || overrideReason,
            geoFence: geoFenceField,
            anomaly: anomalyField,
            shiftId,
          },
        ],
        { session }
      );

      // 6. Emit realtime Socket event
      const io = getIO();
      if (io) {
        io.to(orgId.toString()).emit('attendance_update', {
          employeeId: empId,
          date: today,
          status,
          type: 'CHECKIN',
        });
      }

      // 7. Audit Logging
      await createAuditLog(
        'ATTENDANCE_CHECKIN',
        email,
        'ATTENDANCE',
        attendance.id,
        `Checked in from ${ipAddress} (Status: ${status}, Late: ${isLate}, Verified: ${locationVerified})`,
        orgId
      );

      await session.commitTransaction();

      // 8. Evaluate late penalty AFTER transaction commits (policy-driven, threshold-based)
      if (isLate) {
        await LatePenaltyService.evaluateAndApplyPenalty(orgId, empId, email);
      }

      return attendance;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Logs check-out, calculates working hours, and deducts early checkout penalties transactionally.
   */
  static async checkOut(
    organizationId: string | mongoose.Types.ObjectId,
    attendanceId: string,
    email: string,
    taskReportId?: string
  ): Promise<IAttendance> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const attId = new mongoose.Types.ObjectId(attendanceId);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const attendance = await Attendance.findOne({ _id: attId, organizationId: orgId }).session(session);
      if (!attendance) {
        throw new Error('Attendance record not found.');
      }

      if (currentHour < 17 || (currentHour === 17 && currentMinute < 40)) {
        const todayStr = attendance.date;
        const approvedPerm = await PermissionRequest.findOne({
          organizationId: orgId,
          employeeId: attendance.employeeId,
          date: todayStr,
          approvalStatus: 'APPROVED'
        }).session(session);

        if (!approvedPerm) {
          throw new Error('Checkout is only permitted after 5:40 PM unless you have an approved permission request today.');
        }
      }

      if (attendance.logoutTime) {
        throw new Error('Employee has already checked out for today.');
      }

      let earlyCheckoutNote = '';

      // Resolve shift to check early checkout boundaries
      if (attendance.shiftId) {
        const shift = await Shift.findOne({ _id: attendance.shiftId, organizationId: orgId }).session(session);
        if (shift) {
          const [endH, endM] = shift.endTime.split(':').map(Number);
          const shiftEndToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);

          if (now < shiftEndToday) {
            const diffMs = shiftEndToday.getTime() - now.getTime();
            const permHours = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
            earlyCheckoutNote = ` (${permHours} hours permission applied for early checkout)`;
            
            const employee = await Employee.findOne({ _id: attendance.employeeId, organizationId: orgId }).session(session);
            if (employee && employee.permissionHoursBalance > 0) {
              employee.permissionHoursBalance = Math.max(0, parseFloat((employee.permissionHoursBalance - permHours).toFixed(1)));
              await employee.save({ session });
            }
          }
        }
      } else {
        // Fallback to legacy default 6:00 PM rule
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        if (currentHour < 18 && !(currentHour === 17 && currentMinute >= 40)) {
          const targetSixPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
          const diffMs = targetSixPM.getTime() - now.getTime();
          const permHoursToSix = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
          earlyCheckoutNote = ` (${permHoursToSix} hours permission applied for early checkout before 6:00 PM)`;

          const employee = await Employee.findOne({ _id: attendance.employeeId, organizationId: orgId }).session(session);
          if (employee && employee.permissionHoursBalance > 0) {
            employee.permissionHoursBalance = Math.max(0, parseFloat((employee.permissionHoursBalance - permHoursToSix).toFixed(1)));
            await employee.save({ session });
          }
        }
      }

      const start = new Date(attendance.loginTime).getTime();
      const end = now.getTime();
      const workingHours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));

      attendance.logoutTime = now;
      attendance.workingHours = workingHours;
      attendance.taskSubmitted = !!taskReportId;
      if (earlyCheckoutNote) {
        attendance.overrideReason = (attendance.overrideReason ? attendance.overrideReason + '; ' : '') + earlyCheckoutNote.trim();
      }

      await attendance.save({ session });

      // Emit realtime Socket event
      const io = getIO();
      if (io) {
        io.to(orgId.toString()).emit('attendance_update', {
          employeeId: attendance.employeeId,
          date: attendance.date,
          status: attendance.status,
          type: 'CHECKOUT',
        });
      }

      // Audit Logging
      await createAuditLog(
        'ATTENDANCE_CHECKOUT',
        email,
        'ATTENDANCE',
        attendance.id,
        `Checked out. Total hours: ${workingHours}${earlyCheckoutNote}`,
        orgId
      );

      await session.commitTransaction();
      return attendance;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Force manually updates an attendance record (Admin/HR only).
   */
  static async updateAttendance(
    organizationId: string | mongoose.Types.ObjectId,
    attendanceId: string,
    email: string,
    loginTime?: string,
    logoutTime?: string,
    status?: string
  ): Promise<IAttendance> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const attId = new mongoose.Types.ObjectId(attendanceId);

    const attendance = await Attendance.findOne({ _id: attId, organizationId: orgId });
    if (!attendance) {
      throw new Error('Attendance record not found.');
    }

    if (loginTime) attendance.loginTime = new Date(loginTime);
    if (logoutTime) {
      attendance.logoutTime = new Date(logoutTime);
      const start = new Date(attendance.loginTime).getTime();
      const end = new Date(logoutTime).getTime();
      attendance.workingHours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
    }
    if (status) attendance.status = status;

    await attendance.save();

    await createAuditLog(
      'ATTENDANCE_UPDATE',
      email,
      'ATTENDANCE',
      attendance.id,
      `Manually updated attendance record.`,
      orgId
    );

    return attendance;
  }

  /**
   * Scans for past days' check-ins without checkout, and auto-resolves them to exactly 9 hours.
   */
  static async checkAndProcessForgotCheckout(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    email: string
  ): Promise<void> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId.toString());
    const todayStr = new Date().toISOString().split('T')[0];

    // Find previous attendance records where logoutTime is missing
    const openAttendances = await Attendance.find({
      organizationId: orgId,
      employeeId: empId,
      date: { $lt: todayStr },
      logoutTime: { $exists: false }
    });

    for (const att of openAttendances) {
      const loginTime = new Date(att.loginTime);
      // Set logout to exactly 9 hours after login
      const logoutTime = new Date(loginTime.getTime() + 9 * 60 * 60 * 1000);
      
      att.logoutTime = logoutTime;
      att.workingHours = 9;
      att.isAutoCheckedOut = true;
      att.pendingReportUpdate = true;
      await att.save();

      await createAuditLog(
        'ATTENDANCE_AUTO_CHECKOUT',
        email,
        'ATTENDANCE',
        att.id,
        `Auto-checked out for forgot checkout on ${att.date}. Assigned 9 working hours.`,
        orgId
      );
    }
  }

  /**
   * Returns the salary-cycle start and end date strings for a given date and cycle start day.
   * Example: startDay=10, today=May 29 → { cycleStart: '2026-05-10', cycleEnd: '2026-06-09' }
   * Example: startDay=10, today=May 5  → { cycleStart: '2026-04-10', cycleEnd: '2026-05-09' }
   */
  static getSalaryCycleDates(now: Date, startDay: number): { cycleStart: string; cycleEnd: string } {
    const day = now.getDate();
    const month = now.getMonth(); // 0-indexed
    const year = now.getFullYear();

    // Determine which month the current salary cycle started
    let cycleStartDate: Date;
    if (day >= startDay) {
      // Cycle started this month
      cycleStartDate = new Date(year, month, startDay);
    } else {
      // Cycle started last month (new Date handles month=-1 → Dec of prev year)
      cycleStartDate = new Date(year, month - 1, startDay);
    }

    // Next cycle starts one calendar month later from the cycle start
    const nextCycleStart = new Date(cycleStartDate);
    nextCycleStart.setMonth(nextCycleStart.getMonth() + 1);

    // Cycle ends the day before the next cycle starts
    const cycleEndDate = new Date(nextCycleStart);
    cycleEndDate.setDate(cycleEndDate.getDate() - 1);

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    return { cycleStart: fmt(cycleStartDate), cycleEnd: fmt(cycleEndDate) };
  }
}
