"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIP = exports.checkOut = exports.checkIn = exports.getTodayAttendance = void 0;
const Attendance_js_1 = require("../models/Attendance.js");
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
const checkIn = async (req, res) => {
    const { employeeId, ipAddress, deviceInfo, overrideReason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    try {
        const existing = await Attendance_js_1.Attendance.findOne({ employeeId, date: today });
        if (existing) {
            res.status(400).json({ message: 'Attendance already recorded for today' });
            return;
        }
        const isLate = new Date().getHours() >= 10;
        const isOfficeIP = ipAddress.startsWith('192.168.1.');
        const attendance = await Attendance_js_1.Attendance.create({
            employeeId,
            date: today,
            loginTime: new Date(),
            ipAddress,
            deviceInfo,
            status: overrideReason ? 'WFH' : 'OFFICE',
            isLate,
            locationVerified: isOfficeIP || !!overrideReason,
            overrideReason,
        });
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKIN', req.user?.email || 'Employee', 'ATTENDANCE', attendance.id, `Checked in from ${ipAddress}`);
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
        const logoutTime = new Date();
        const start = new Date(attendance.loginTime).getTime();
        const end = logoutTime.getTime();
        const workingHours = parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
        attendance.logoutTime = logoutTime;
        attendance.workingHours = workingHours;
        attendance.taskSubmitted = !!taskReportId;
        await attendance.save();
        await (0, auditLog_service_js_1.createAuditLog)('ATTENDANCE_CHECKOUT', req.user?.email || 'Employee', 'ATTENDANCE', attendance.id, `Checked out. Total hours: ${workingHours}`);
        res.status(200).json({ attendance });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.checkOut = checkOut;
const verifyIP = async (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '192.168.1.50';
    const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    const isOfficeIP = ipString.includes('192.168.1.') || ipString === '127.0.0.1' || ipString === '::1';
    res.status(200).json({ isOfficeIP, currentIP: ipString });
};
exports.verifyIP = verifyIP;
