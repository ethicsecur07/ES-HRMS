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
const HolidayCalendar_js_1 = require("../../../models/HolidayCalendar.js");
const ipHelper_js_1 = require("../../../utils/ipHelper.js");
class TimezoneHelper {
    static getInfo(date, timezone) {
        const tz = (!timezone || timezone === 'UTC') ? 'Asia/Kolkata' : timezone;
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const parts = formatter.formatToParts(date);
        const partValues = {};
        for (const part of parts) {
            partValues[part.type] = part.value;
        }
        const year = parseInt(partValues.year, 10);
        const month = parseInt(partValues.month, 10) - 1; // 0-indexed
        const day = parseInt(partValues.day, 10);
        const hour = parseInt(partValues.hour, 10);
        const minute = parseInt(partValues.minute, 10);
        const second = parseInt(partValues.second, 10);
        const tzDate = new Date(Date.UTC(year, month, day, hour, minute, second));
        const dateString = `${partValues.year}-${partValues.month}-${partValues.day}`;
        return {
            year,
            month,
            day,
            hour,
            minute,
            second,
            dayOfWeek: tzDate.getUTCDay(),
            dateString,
        };
    }
    static getUtcDate(year, month, day, hour, minute, second, timezone) {
        const tz = (!timezone || timezone === 'UTC') ? 'Asia/Kolkata' : timezone;
        const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
        const tzInfo = TimezoneHelper.getInfo(utcDate, tz);
        const formattedUtc = Date.UTC(tzInfo.year, tzInfo.month, tzInfo.day, tzInfo.hour, tzInfo.minute, tzInfo.second);
        const diffMs = utcDate.getTime() - formattedUtc;
        return new Date(utcDate.getTime() + diffMs);
    }
}
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
        else if (role === 'ADMIN') {
            const allowedUsers = await User_js_1.User.find({
                organizationId: orgId,
                role: { $in: ['HR', 'MANAGER'] },
                employeeId: { $exists: true, $ne: null }
            }).select('employeeId');
            const allowedEmployeeIds = allowedUsers.map(u => u.employeeId);
            query.employeeId = { $in: allowedEmployeeIds };
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
        else if (role === 'ADMIN') {
            const allowedUsers = await User_js_1.User.find({
                organizationId: orgId,
                role: { $in: ['HR', 'MANAGER'] },
                employeeId: { $exists: true, $ne: null }
            }).select('employeeId');
            const allowedEmployeeIds = allowedUsers.map(u => u.employeeId);
            query.employeeId = { $in: allowedEmployeeIds };
        }
        return Attendance_js_1.Attendance.find(query).populate('employeeId').sort({ date: -1, loginTime: -1 });
    }
    /**
     * Logs a secure check-in. Validates tenant scope, IP whitelist, GPS geofences, and handles late marks.
     */
    static async checkIn(organizationId, employeeId, email, ipAddress, deviceInfo, overrideReason, lat, lng) {
        const orgId = new mongoose_1.default.Types.ObjectId(organizationId.toString());
        let empId = new mongoose_1.default.Types.ObjectId(employeeId);
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            // Fetch organization settings to resolve timezone, active workdays, and allowed IPs
            const org = await Organization_js_1.Organization.findOne({ _id: orgId })
                .session(session)
                .select('settings.activeWorkdays settings.timezone settings.salaryCycleStartDay settings.allowedIPs');
            const timezone = org?.settings?.timezone || 'Asia/Kolkata';
            const now = new Date();
            const nowInfo = TimezoneHelper.getInfo(now, timezone);
            const today = nowInfo.dateString;
            // 1. Validate employee exists in organization
            let employee = await Employee_js_1.Employee.findOne({ _id: empId, organizationId: orgId }).session(session);
            if (!employee) {
                // Fallback: search for employee by email
                employee = await Employee_js_1.Employee.findOne({ email: email.toLowerCase(), organizationId: orgId }).session(session);
                if (!employee) {
                    // Find the User document
                    const userDoc = await User_js_1.User.findOne({ email: email.toLowerCase(), organizationId: orgId }).session(session);
                    if (userDoc) {
                        // Auto-create matching Employee profile
                        const code = 'EMP-' + Math.floor(1000 + Math.random() * 9000);
                        const dept = userDoc.ssoData?.department || (userDoc.role === 'HR' ? 'HR' : 'Management');
                        const desig = userDoc.ssoData?.jobTitle || userDoc.role;
                        [employee] = await Employee_js_1.Employee.create([
                            {
                                organizationId: orgId,
                                employeeCode: code,
                                fullName: userDoc.name,
                                email: userDoc.email,
                                phone: '0000000000',
                                department: dept,
                                designation: desig,
                                joiningDate: new Date(),
                                salary: 0,
                                address: 'Office Address',
                                emergencyContact: {
                                    name: 'Self',
                                    relationship: 'Self',
                                    phone: '0000000000',
                                },
                                isActive: true,
                            }
                        ], { session });
                        // Link User to Employee
                        userDoc.employeeId = employee._id;
                        await userDoc.save({ session });
                    }
                }
            }
            if (!employee) {
                throw new Error('Target employee not found in this organization.');
            }
            // Reassign empId to the correct found/created Employee ID
            empId = employee._id;
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
            // 2.5. Prevent check-in on Sundays, holidays, and non-working days
            const isSunday = nowInfo.dayOfWeek === 0;
            // Enforce Sunday check
            if (isSunday) {
                throw new Error('Check-in is disabled on Sundays.');
            }
            // Enforce 9:00 AM check-in constraint (not applicable on Sundays)
            if (!isSunday && nowInfo.hour < 9) {
                throw new Error('Check-in is only permitted after 9:00 AM.');
            }
            // Enforce Active Workdays check
            const activeWorkdays = org?.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
            const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const currentDayLabel = DAY_LABELS[nowInfo.dayOfWeek];
            if (!activeWorkdays.includes(currentDayLabel)) {
                throw new Error(`Check-in is not allowed on non-working days (${currentDayLabel}).`);
            }
            // Enforce Company Holiday check
            const publicHoliday = await HolidayCalendar_js_1.HolidayCalendar.findOne({
                organizationId: orgId,
                date: today
            }).session(session);
            if (publicHoliday) {
                throw new Error(`Check-in is disabled today due to the holiday: ${publicHoliday.name}.`);
            }
            // 3. Verify location (Office IP Range or GPS GeoFence)
            const allowedIPs = org?.settings?.allowedIPs || ['127.0.0.1', '::1'];
            const isOfficeIP = (0, ipHelper_js_1.ipMatchesRange)(ipAddress, allowedIPs);
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
            const status = isOfficeIP ? 'OFFICE' : 'WFH';
            const locationVerified = isOfficeIP || status === 'WFH' || withinGeoFence || !!overrideReason;
            let isLate = false;
            let lateReason = '';
            // 4. Resolve shift and evaluate late-in check
            const resolvedShift = await ShiftService_js_1.ShiftService.getAssignedShiftForDate(orgId, empId, now);
            let shiftId = undefined;
            if (resolvedShift) {
                shiftId = resolvedShift._id;
                const [shiftHour, shiftMin] = resolvedShift.startTime.split(':').map(Number);
                const shiftStartToday = TimezoneHelper.getUtcDate(nowInfo.year, nowInfo.month, nowInfo.day, shiftHour, shiftMin, 0, timezone);
                // Add 15 minutes grace period
                const thresholdTime = new Date(shiftStartToday.getTime() + 15 * 60 * 1000);
                if (now > thresholdTime) {
                    isLate = true;
                    lateReason = 'Late check-in after shift grace period';
                }
            }
            else {
                // Fallback to legacy default 9:35 AM rule
                if (nowInfo.hour > 9 || (nowInfo.hour === 9 && nowInfo.minute > 35)) {
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
            const currentMinutes = nowInfo.hour * 60 + nowInfo.minute;
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
                const startDay = org?.settings?.salaryCycleStartDay ?? 10;
                const { cycleStart, cycleEnd } = AttendanceService.getSalaryCycleDates(now, startDay, timezone);
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
            const org = await Organization_js_1.Organization.findOne({ _id: orgId })
                .session(session)
                .select('settings.timezone');
            const timezone = org?.settings?.timezone || 'Asia/Kolkata';
            const now = new Date();
            const nowInfo = TimezoneHelper.getInfo(now, timezone);
            const attendance = await Attendance_js_1.Attendance.findOne({ _id: attId, organizationId: orgId }).session(session);
            if (!attendance) {
                throw new Error('Attendance record not found.');
            }
            if (nowInfo.hour < 17 || (nowInfo.hour === 17 && nowInfo.minute < 40)) {
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
                    const shiftEndToday = TimezoneHelper.getUtcDate(nowInfo.year, nowInfo.month, nowInfo.day, endH, endM, 0, timezone);
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
                if (nowInfo.hour < 18 && !(nowInfo.hour === 17 && nowInfo.minute >= 40)) {
                    const targetSixPM = TimezoneHelper.getUtcDate(nowInfo.year, nowInfo.month, nowInfo.day, 18, 0, 0, timezone);
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
        const org = await Organization_js_1.Organization.findOne({ _id: orgId }).select('settings.timezone');
        const timezone = org?.settings?.timezone || 'Asia/Kolkata';
        const now = new Date();
        const nowInfo = TimezoneHelper.getInfo(now, timezone);
        const todayStr = nowInfo.dateString;
        const currentHour = nowInfo.hour;
        // Only auto-checkout for past days to avoid checking out active sessions today
        const queryDate = { $lt: todayStr };
        // Find attendance records where logoutTime is missing
        const openAttendances = await Attendance_js_1.Attendance.find({
            organizationId: orgId,
            employeeId: empId,
            date: queryDate,
            logoutTime: { $exists: false }
        });
        for (const att of openAttendances) {
            const loginTime = new Date(att.loginTime);
            // att.date is a string in YYYY-MM-DD format (e.g. "2026-06-03").
            const [year, month, day] = att.date.split('-').map(Number);
            // Set logout to exactly 6:00 PM (18:00) on that day in the organization's local timezone
            const logoutTime = TimezoneHelper.getUtcDate(year, month - 1, day, 18, 0, 0, timezone);
            let workingHours = parseFloat(((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
            if (workingHours <= 0) {
                // Fallback to exactly 9 hours after login if login was after 6:00 PM
                logoutTime.setTime(loginTime.getTime() + 9 * 60 * 60 * 1000);
                workingHours = 9;
            }
            att.logoutTime = logoutTime;
            att.workingHours = workingHours;
            att.isAutoCheckedOut = true;
            att.pendingReportUpdate = true;
            await att.save();
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_AUTO_CHECKOUT', email, 'ATTENDANCE', att.id, `Auto-checked out at 6:00 PM for forgot checkout on ${att.date}. Total hours: ${workingHours}`, orgId);
        }
    }
    /**
     * Returns the salary-cycle start and end date strings for a given date and cycle start day.
     * Example: startDay=10, today=May 29 → { cycleStart: '2026-05-10', cycleEnd: '2026-06-09' }
     * Example: startDay=10, today=May 5  → { cycleStart: '2026-04-10', cycleEnd: '2026-05-09' }
     */
    static getSalaryCycleDates(now, startDay, timezone) {
        const nowInfo = TimezoneHelper.getInfo(now, timezone);
        let startYear = nowInfo.year;
        let startMonth = nowInfo.month; // 0-indexed: 0 = Jan, 11 = Dec
        if (nowInfo.day < startDay) {
            // Cycle started in the previous month
            startMonth -= 1;
            if (startMonth < 0) {
                startMonth = 11;
                startYear -= 1;
            }
        }
        // Next cycle starts exactly one month later
        let nextYear = startYear;
        let nextMonth = startMonth + 1;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear += 1;
        }
        // The cycle ends the day before the next cycle starts.
        // To find the day before nextYear-nextMonth-startDay:
        const nextStartUtc = new Date(Date.UTC(nextYear, nextMonth, startDay));
        const endUtc = new Date(nextStartUtc.getTime() - 24 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        const cycleStart = `${startYear}-${pad(startMonth + 1)}-${pad(startDay)}`;
        const cycleEnd = `${endUtc.getUTCFullYear()}-${pad(endUtc.getUTCMonth() + 1)}-${pad(endUtc.getUTCDate())}`;
        return { cycleStart, cycleEnd };
    }
}
exports.AttendanceService = AttendanceService;
