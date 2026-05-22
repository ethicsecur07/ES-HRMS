"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Attendance_js_1 = require("../models/Attendance.js");
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
class AttendanceService {
    static async getTodayAttendance(organizationId, userId, role, email) {
        const today = new Date().toISOString().split('T')[0];
        const query = { date: today, organizationId };
        if (role === 'EMPLOYEE' && userId && email) {
            const user = await User_js_1.User.findOne({ _id: userId, organizationId });
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email, organizationId });
                if (employee)
                    employeeId = employee._id;
            }
            if (employeeId) {
                query.employeeId = employeeId;
            }
            else {
                return [];
            }
        }
        return Attendance_js_1.Attendance.find(query).populate('employeeId');
    }
    static async getAllAttendance(organizationId, userId, role, email) {
        const query = { organizationId };
        if (role === 'EMPLOYEE' && userId && email) {
            const user = await User_js_1.User.findOne({ _id: userId, organizationId });
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email, organizationId });
                if (employee)
                    employeeId = employee._id;
            }
            if (employeeId) {
                query.employeeId = employeeId;
            }
            else {
                return [];
            }
        }
        return Attendance_js_1.Attendance.find(query).populate('employeeId').sort({ date: -1, loginTime: -1 });
    }
    static async checkIn(organizationId, employeeId, email, ipAddress, deviceInfo, overrideReason) {
        const today = new Date().toISOString().split('T')[0];
        const existing = await Attendance_js_1.Attendance.findOne({ employeeId, date: today, organizationId });
        if (existing)
            throw new Error('Attendance already recorded for today');
        const isOfficeIP = ipAddress.includes('192.168.29.') || ipAddress === '127.0.0.1' || ipAddress === '::1';
        const now = new Date();
        let loginTime = now;
        let status = isOfficeIP ? 'OFFICE' : 'WFH';
        let isLate = false;
        let casualLeaveNote = '';
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            if (currentHour < 9 || (currentHour === 9 && currentMinute <= 35)) {
                loginTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
            }
            else {
                status = 'LEAVE';
                isLate = true;
                casualLeaveNote = 'Casual Leave applied (Late check-in after 9:35 AM)';
                const emp = await Employee_js_1.Employee.findOne({ _id: employeeId, organizationId }).session(session);
                if (emp && emp.leaveBalance > 0) {
                    emp.leaveBalance -= 1;
                    await emp.save({ session });
                }
            }
            const attendance = await Attendance_js_1.Attendance.create([{
                    organizationId,
                    employeeId,
                    date: today,
                    loginTime,
                    ipAddress,
                    deviceInfo,
                    status,
                    isLate,
                    locationVerified: isOfficeIP || !!overrideReason,
                    overrideReason: casualLeaveNote || overrideReason,
                }], { session });
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKIN', email, 'ATTENDANCE', attendance[0].id, `Checked in from ${ipAddress} (Status: ${status})`, organizationId);
            await session.commitTransaction();
            return attendance[0];
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    static async checkOut(organizationId, attendanceId, email, taskReportId) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const attendance = await Attendance_js_1.Attendance.findOne({ _id: attendanceId, organizationId }).session(session);
            if (!attendance)
                throw new Error('Attendance record not found');
            const now = new Date();
            let logoutTime = now;
            let earlyCheckoutNote = '';
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            if (currentHour >= 18 || (currentHour === 17 && currentMinute >= 40)) {
                logoutTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
            }
            else {
                const targetSixPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
                const diffMs = targetSixPM.getTime() - now.getTime();
                const permHoursToSix = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
                earlyCheckoutNote = ` (${permHoursToSix} hours permission applied for early checkout before 6:00 PM)`;
                const emp = await Employee_js_1.Employee.findOne({ _id: attendance.employeeId, organizationId }).session(session);
                if (emp && emp.permissionHoursBalance > 0) {
                    emp.permissionHoursBalance = Math.max(0, parseFloat((emp.permissionHoursBalance - permHoursToSix).toFixed(1)));
                    await emp.save({ session });
                }
            }
            const start = new Date(attendance.loginTime).getTime();
            const end = logoutTime.getTime();
            const workingHours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
            attendance.logoutTime = logoutTime;
            attendance.workingHours = workingHours;
            attendance.taskSubmitted = !!taskReportId;
            if (earlyCheckoutNote) {
                attendance.overrideReason = (attendance.overrideReason ? attendance.overrideReason + '; ' : '') + earlyCheckoutNote.trim();
            }
            await attendance.save({ session });
            await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKOUT', email, 'ATTENDANCE', attendance.id, `Checked out. Total hours: ${workingHours}${earlyCheckoutNote}`, organizationId);
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
    static async updateAttendance(organizationId, attendanceId, email, loginTime, logoutTime, status) {
        const attendance = await Attendance_js_1.Attendance.findOne({ _id: attendanceId, organizationId });
        if (!attendance)
            throw new Error('Attendance record not found');
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
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_UPDATE', email, 'ATTENDANCE', attendance.id, `Manually updated attendance record.`, organizationId);
        return attendance;
    }
}
exports.AttendanceService = AttendanceService;
