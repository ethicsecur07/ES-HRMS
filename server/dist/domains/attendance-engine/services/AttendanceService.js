"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Attendance_js_1 = require("../../../models/Attendance.js");
const Employee_js_1 = require("../../../models/Employee.js");
const User_js_1 = require("../../../models/User.js");
const AdvancedAttendanceEngine_js_1 = require("../../../models/AdvancedAttendanceEngine.js");
const Shift_js_1 = require("../../../models/Shift.js");
const ShiftService_js_1 = require("./ShiftService.js");
const auditLog_service_js_1 = require("../../../services/auditLog.service.js");
const socketHandler_js_1 = require("../../../sockets/socketHandler.js");
const LatePenaltyService_js_1 = require("../../leave-engine/services/LatePenaltyService.js");
const PermissionRequest_js_1 = require("../../../models/PermissionRequest.js");
const Leave_js_1 = require("../../../models/Leave.js");
const Organization_js_1 = require("../../../models/Organization.js");
// Haversine formula helper
const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};
class AttendanceService {
    /**
     * Retrieves today's attendance records for the tenant, restricted to the employee's own logs if requested.
     */
    static async getTodayAttendance(organizationId, userId, role, email) {
        const today = new Date().toISOString().split('T')[0];
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const query = { date: today, organizationId: orgId };
        if (role === 'EMPLOYEE' && userId && email) {
            const user = await User_js_1.User.findOne({ _id: userId, organizationId: orgId });
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email, organizationId: orgId });
                if (employee)
                    employeeId = employee._id;
            }
            if (employeeId) {
                await AttendanceService.checkAndProcessForgotCheckout(organizationId, employeeId, email);
                query.employeeId = employeeId;
            }
            else {
                return [];
            }
        }
        return Attendance_js_1.Attendance.find(query).populate('employeeId');
    }
    /**
     * Retrieves all historical attendance records, restricted to the employee's own logs if requested.
     */
    static async getAllAttendance(organizationId, userId, role, email) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const query = { organizationId: orgId };
        if (role === 'EMPLOYEE' && userId && email) {
            const user = await User_js_1.User.findOne({ _id: userId, organizationId: orgId });
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email, organizationId: orgId });
                if (employee)
                    employeeId = employee._id;
            }
            if (employeeId) {
                await AttendanceService.checkAndProcessForgotCheckout(organizationId, employeeId, email);
                query.employeeId = employeeId;
            }
            else {
                return [];
            }
        }
        return Attendance_js_1.Attendance.find(query).populate('employeeId').sort({ date: -1, loginTime: -1 });
    }
    /**
     * Logs a secure check-in. Validates tenant scope, IP whitelist, GPS geofences, and handles late marks.
     */
    static async checkIn(organizationId, employeeId, email, ipAddress, deviceInfo, overrideReason, lat, lng) {
        const today = new Date().toISOString().split('T')[0];
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const empId = new mongoose_1.default.Types.ObjectId(employeeId);
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // 1. Validate employee exists in organization
            const employee = await Employee_js_1.Employee.findOne({ _id: empId, organizationId: orgId }).session(session);
            if (!employee) {
                throw new Error('Target employee not found in this organization.');
            }
            // 1.5 Enforce Approved Leave Block (Do not allow check-in on approved leave days)
            const approvedLeaveToday = await Leave_js_1.Leave.findOne({
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
            const existing = await Attendance_js_1.Attendance.findOne({ employeeId: empId, date: today, organizationId: orgId }).session(session);
            if (existing) {
                throw new Error('Attendance already recorded for today.');
            }
            // 3. Verify location (Office IP Range or GPS GeoFence)
            const isOfficeIP = ipAddress.includes('192.168.29.') || ipAddress === '127.0.0.1' || ipAddress === '::1';
            let withinGeoFence = false;
            let matchedFence = null;
            let distanceFromCenter = 0;
            if (lat !== undefined && lng !== undefined) {
                const fences = await AdvancedAttendanceEngine_js_1.GeoFence.find({ organizationId: orgId, isActive: true }).session(session);
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
            const resolvedShift = await ShiftService_js_1.ShiftService.getAssignedShiftForDate(orgId, empId, now);
            let shiftId = undefined;
            if (resolvedShift) {
                shiftId = resolvedShift._id;
                const [shiftHour, shiftMin] = resolvedShift.startTime.split(':').map(Number);
                const shiftStartToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMin, 0);
                // Add 15 minutes grace period
                const thresholdTime = new Date(shiftStartToday.getTime() + 15 * 60 * 1000);
                if (now > thresholdTime) {
                    isLate = true;
                    lateReason = 'Late check-in after shift grace period';
                }
            }
            else {
                // Fallback to legacy default 9:35 AM rule
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                if (currentHour > 9 || (currentHour === 9 && currentMinute > 35)) {
                    isLate = true;
                    lateReason = 'Late check-in after default 9:35 AM threshold';
                }
            }
            // 4b. Enforce Morning/Scheduled Permission Block
            const activePermissions = await PermissionRequest_js_1.PermissionRequest.find({
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
            //   - 2nd+ late in the cycle → auto-create & approve a Casual Leave for today, then allow check-in with a warning
            if (isLate) {
                // Fetch org salary cycle start day (default 10 → cycle runs 10th to 9th)
                const org = await Organization_js_1.Organization.findOne({ _id: orgId })
                    .session(session)
                    .select('settings.salaryCycleStartDay');
                const startDay = org?.settings?.salaryCycleStartDay ?? 10;
                const { cycleStart, cycleEnd } = AttendanceService.getSalaryCycleDates(now, startDay);
                const priorLateCount = await Attendance_js_1.Attendance.countDocuments({
                    organizationId: orgId,
                    employeeId: empId,
                    isLate: true,
                    date: { $gte: cycleStart, $lte: cycleEnd }
                }).session(session);
                // 2nd+ late in this salary cycle → auto-apply a PENDING Casual Leave for today and block check-in
                if (priorLateCount >= 1) {
                    const todayDateStr = today;
                    // Only create if no leave already exists for today to avoid duplicates
                    const existingLeave = await Leave_js_1.Leave.findOne({
                        organizationId: orgId,
                        employeeId: empId,
                        startDate: { $lte: todayDateStr },
                        endDate: { $gte: todayDateStr },
                        status: { $in: ['PENDING', 'APPROVED'] },
                    });
                    if (!existingLeave) {
                        await Leave_js_1.Leave.create([
                            {
                                organizationId: orgId,
                                employeeId: empId,
                                leaveType: 'Casual Leave',
                                startDate: todayDateStr,
                                endDate: todayDateStr,
                                totalDays: 1,
                                isHalfDay: false,
                                reason: `Auto-applied: Late check-in (2nd occurrence in salary cycle ${cycleStart} → ${cycleEnd})`,
                                status: 'PENDING',
                                appliedAt: now,
                            }
                        ]);
                    }
                    throw new Error(`Check-in blocked: This is your ${priorLateCount + 1}${priorLateCount + 1 === 2 ? 'nd' : 'th'} late check-in this salary cycle ` +
                        `(${cycleStart} → ${cycleEnd}). A Casual Leave request has been automatically applied and is pending HR approval.`);
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
                anomalyType: 'GEO_BREACH',
                description: `Unverified check-in location (IP: ${ipAddress}, Coords: ${lat}, ${lng}).`,
                isResolved: false,
            } : undefined;
            const [attendance] = await Attendance_js_1.Attendance.create([
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
            ], { session });
            // 6. Emit realtime Socket event
            const io = (0, socketHandler_js_1.getIO)();
            if (io) {
                io.to(orgId.toString()).emit('attendance_update', {
                    employeeId: empId,
                    date: today,
                    status,
                    type: 'CHECKIN',
                });
            }
            // 7. Audit Logging
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKIN', email, 'ATTENDANCE', attendance.id, `Checked in from ${ipAddress} (Status: ${status}, Late: ${isLate}, Verified: ${locationVerified})`, orgId);
            await session.commitTransaction();
            // 8. Evaluate late penalty AFTER transaction commits (policy-driven, threshold-based)
            if (isLate) {
                await LatePenaltyService_js_1.LatePenaltyService.evaluateAndApplyPenalty(orgId, empId, email);
            }
            return attendance;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Logs check-out, calculates working hours, and deducts early checkout penalties transactionally.
     */
    static async checkOut(organizationId, attendanceId, email, taskReportId) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const attId = new mongoose_1.default.Types.ObjectId(attendanceId);
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const attendance = await Attendance_js_1.Attendance.findOne({ _id: attId, organizationId: orgId }).session(session);
            if (!attendance) {
                throw new Error('Attendance record not found.');
            }
            if (currentHour < 17 || (currentHour === 17 && currentMinute < 40)) {
                const todayStr = attendance.date;
                const approvedPerm = await PermissionRequest_js_1.PermissionRequest.findOne({
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
                const shift = await Shift_js_1.Shift.findOne({ _id: attendance.shiftId, organizationId: orgId }).session(session);
                if (shift) {
                    const [endH, endM] = shift.endTime.split(':').map(Number);
                    const shiftEndToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0);
                    if (now < shiftEndToday) {
                        const diffMs = shiftEndToday.getTime() - now.getTime();
                        const permHours = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
                        earlyCheckoutNote = ` (${permHours} hours permission applied for early checkout)`;
                        const employee = await Employee_js_1.Employee.findOne({ _id: attendance.employeeId, organizationId: orgId }).session(session);
                        if (employee && employee.permissionHoursBalance > 0) {
                            employee.permissionHoursBalance = Math.max(0, parseFloat((employee.permissionHoursBalance - permHours).toFixed(1)));
                            await employee.save({ session });
                        }
                    }
                }
            }
            else {
                // Fallback to legacy default 6:00 PM rule
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                if (currentHour < 18 && !(currentHour === 17 && currentMinute >= 40)) {
                    const targetSixPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
                    const diffMs = targetSixPM.getTime() - now.getTime();
                    const permHoursToSix = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
                    earlyCheckoutNote = ` (${permHoursToSix} hours permission applied for early checkout before 6:00 PM)`;
                    const employee = await Employee_js_1.Employee.findOne({ _id: attendance.employeeId, organizationId: orgId }).session(session);
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
            const io = (0, socketHandler_js_1.getIO)();
            if (io) {
                io.to(orgId.toString()).emit('attendance_update', {
                    employeeId: attendance.employeeId,
                    date: attendance.date,
                    status: attendance.status,
                    type: 'CHECKOUT',
                });
            }
            // Audit Logging
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKOUT', email, 'ATTENDANCE', attendance.id, `Checked out. Total hours: ${workingHours}${earlyCheckoutNote}`, orgId);
            await session.commitTransaction();
            return attendance;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Force manually updates an attendance record (Admin/HR only).
     */
    static async updateAttendance(organizationId, attendanceId, email, loginTime, logoutTime, status) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const attId = new mongoose_1.default.Types.ObjectId(attendanceId);
        const attendance = await Attendance_js_1.Attendance.findOne({ _id: attId, organizationId: orgId });
        if (!attendance) {
            throw new Error('Attendance record not found.');
        }
        if (loginTime)
            attendance.loginTime = new Date(loginTime);
        if (logoutTime) {
            attendance.logoutTime = new Date(logoutTime);
            const start = new Date(attendance.loginTime).getTime();
            const end = new Date(logoutTime).getTime();
            attendance.workingHours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
        }
        if (status)
            attendance.status = status;
        await attendance.save();
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_UPDATE', email, 'ATTENDANCE', attendance.id, `Manually updated attendance record.`, orgId);
        return attendance;
    }
    /**
     * Scans for past days' check-ins without checkout, and auto-resolves them to exactly 9 hours.
     */
    static async checkAndProcessForgotCheckout(organizationId, employeeId, email) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        const empId = new mongoose_1.default.Types.ObjectId(employeeId.toString());
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        const currentHour = now.getHours();
        // If it is >= 7:00 PM (19:00), we can check out today's record as well
        const queryDate = currentHour >= 19 ? { $lte: todayStr } : { $lt: todayStr };
        // Find attendance records where logoutTime is missing
        const openAttendances = await Attendance_js_1.Attendance.find({
            organizationId: orgId,
            employeeId: empId,
            date: queryDate,
            logoutTime: { $exists: false }
        });
        for (const att of openAttendances) {
            const loginTime = new Date(att.loginTime);
            // Set logout to exactly 7:00 PM (19:00) on that day in local time
            const logoutTime = new Date(loginTime);
            logoutTime.setHours(19, 0, 0, 0);
            let workingHours = parseFloat(((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
            if (workingHours <= 0) {
                // Fallback to exactly 9 hours after login if login was after 7:00 PM
                logoutTime.setTime(loginTime.getTime() + 9 * 60 * 60 * 1000);
                workingHours = 9;
            }
            att.logoutTime = logoutTime;
            att.workingHours = workingHours;
            att.isAutoCheckedOut = true;
            att.pendingReportUpdate = true;
            await att.save();
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_AUTO_CHECKOUT', email, 'ATTENDANCE', att.id, `Auto-checked out at 7:00 PM for forgot checkout on ${att.date}. Total hours: ${workingHours}`, orgId);
        }
    }
    /**
     * Returns the salary-cycle start and end date strings for a given date and cycle start day.
     * Example: startDay=10, today=May 29 → { cycleStart: '2026-05-10', cycleEnd: '2026-06-09' }
     * Example: startDay=10, today=May 5  → { cycleStart: '2026-04-10', cycleEnd: '2026-05-09' }
     */
    static getSalaryCycleDates(now, startDay) {
        const day = now.getDate();
        const month = now.getMonth(); // 0-indexed
        const year = now.getFullYear();
        // Determine which month the current salary cycle started
        let cycleStartDate;
        if (day >= startDay) {
            // Cycle started this month
            cycleStartDate = new Date(year, month, startDay);
        }
        else {
            // Cycle started last month (new Date handles month=-1 → Dec of prev year)
            cycleStartDate = new Date(year, month - 1, startDay);
        }
        // Next cycle starts one calendar month later from the cycle start
        const nextCycleStart = new Date(cycleStartDate);
        nextCycleStart.setMonth(nextCycleStart.getMonth() + 1);
        // Cycle ends the day before the next cycle starts
        const cycleEndDate = new Date(nextCycleStart);
        cycleEndDate.setDate(cycleEndDate.getDate() - 1);
        const pad = (n) => String(n).padStart(2, '0');
        const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return { cycleStart: fmt(cycleStartDate), cycleEnd: fmt(cycleEndDate) };
    }
}
exports.AttendanceService = AttendanceService;
