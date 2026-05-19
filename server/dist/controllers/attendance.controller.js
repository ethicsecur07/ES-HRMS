"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttendance = exports.verifyIP = exports.checkOut = exports.checkIn = exports.getAllAttendance = exports.getTodayAttendance = void 0;
const Attendance_js_1 = require("../models/Attendance.js");
const Employee_js_1 = require("../models/Employee.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const getTodayAttendance = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const attendances = await Attendance_js_1.Attendance.find({ date: today }).populate('employeeId');
        res.status(200).json({ attendances });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTodayAttendance = getTodayAttendance;
const getAllAttendance = async (req, res) => {
    try {
        const attendances = await Attendance_js_1.Attendance.find().populate('employeeId').sort({ date: -1, loginTime: -1 });
        res.status(200).json({ attendances });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllAttendance = getAllAttendance;
const checkIn = async (req, res) => {
    const { employeeId, deviceInfo, overrideReason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    try {
        const existing = await Attendance_js_1.Attendance.findOne({ employeeId, date: today });
        if (existing) {
            res.status(400).json({ message: 'Attendance already recorded for today' });
            return;
        }
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '192.168.29.50';
        const ipAddress = Array.isArray(clientIP) ? clientIP[0] : clientIP;
        const isOfficeIP = ipAddress.includes('192.168.29.') || ipAddress === '127.0.0.1' || ipAddress === '::1';
        const now = new Date();
        let loginTime = now;
        let status = isOfficeIP ? 'OFFICE' : 'WFH';
        let isLate = false;
        let casualLeaveNote = '';
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        // Before 9:35 AM -> calculate to 9:00 AM
        if (currentHour < 9 || (currentHour === 9 && currentMinute <= 35)) {
            loginTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
        }
        else {
            // After 9:35 AM -> employee is considered by casual leave on that day
            status = 'LEAVE';
            isLate = true;
            casualLeaveNote = 'Casual Leave applied (Late check-in after 9:35 AM)';
            const emp = await Employee_js_1.Employee.findById(employeeId);
            if (emp && emp.leaveBalance > 0) {
                emp.leaveBalance -= 1;
                await emp.save();
            }
        }
        const attendance = await Attendance_js_1.Attendance.create({
            employeeId,
            date: today,
            loginTime,
            ipAddress,
            deviceInfo,
            status,
            isLate,
            locationVerified: isOfficeIP || !!overrideReason,
            overrideReason: casualLeaveNote || overrideReason,
        });
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKIN', req.user?.email || 'Employee', 'ATTENDANCE', attendance.id, `Checked in from ${ipAddress} (Status: ${status})`);
        res.status(201).json({ attendance });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.checkIn = checkIn;
const checkOut = async (req, res) => {
    const { id } = req.params;
    const { taskReportId } = req.body;
    try {
        const attendance = await Attendance_js_1.Attendance.findById(id);
        if (!attendance) {
            res.status(404).json({ message: 'Attendance record not found' });
            return;
        }
        const now = new Date();
        let logoutTime = now;
        let earlyCheckoutNote = '';
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        // 5:40 PM (17:40) or after -> consider 6:00 PM (18:00)
        if (currentHour >= 18 || (currentHour === 17 && currentMinute >= 40)) {
            logoutTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        }
        else {
            // Before 5:40 PM -> calculate how many hours to 6:00 PM consider that calculate hours permission
            const targetSixPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
            const diffMs = targetSixPM.getTime() - now.getTime();
            const permHoursToSix = Math.max(0.5, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1)));
            earlyCheckoutNote = ` (${permHoursToSix} hours permission applied for early checkout before 6:00 PM)`;
            const emp = await Employee_js_1.Employee.findById(attendance.employeeId);
            if (emp && emp.permissionHoursBalance > 0) {
                emp.permissionHoursBalance = Math.max(0, parseFloat((emp.permissionHoursBalance - permHoursToSix).toFixed(1)));
                await emp.save();
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
        await attendance.save();
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKOUT', req.user?.email || 'Employee', 'ATTENDANCE', attendance.id, `Checked out. Total hours: ${workingHours}${earlyCheckoutNote}`);
        res.status(200).json({ attendance });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.checkOut = checkOut;
const verifyIP = async (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '192.168.29.50';
    const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    const isOfficeIP = ipString.includes('192.168.29.') || ipString === '127.0.0.1' || ipString === '::1';
    res.status(200).json({ isOfficeIP, currentIP: ipString });
};
exports.verifyIP = verifyIP;
const updateAttendance = async (req, res) => {
    const { id } = req.params;
    const { loginTime, logoutTime, status } = req.body;
    try {
        const attendance = await Attendance_js_1.Attendance.findById(id);
        if (!attendance) {
            res.status(404).json({ message: 'Attendance record not found' });
            return;
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
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_UPDATE', req.user?.email || 'HR/Admin', 'ATTENDANCE', attendance.id, `Manually updated attendance record.`);
        res.status(200).json({ attendance });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateAttendance = updateAttendance;
