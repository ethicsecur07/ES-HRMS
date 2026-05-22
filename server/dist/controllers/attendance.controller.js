"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAttendance = exports.verifyIP = exports.checkOut = exports.checkIn = exports.getAllAttendance = exports.getTodayAttendance = void 0;
const AttendanceService_js_1 = require("../domains/attendance-engine/services/AttendanceService.js");
const getTodayAttendance = async (req, res) => {
    try {
        const authReq = req;
        const { organizationId, id: userId, role, email } = authReq.user || {};
        if (!organizationId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const attendances = await AttendanceService_js_1.AttendanceService.getTodayAttendance(organizationId, userId, role, email);
        res.status(200).json({ data: attendances });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTodayAttendance = getTodayAttendance;
const getAllAttendance = async (req, res) => {
    try {
        const authReq = req;
        const { organizationId, id: userId, role, email } = authReq.user || {};
        if (!organizationId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const attendances = await AttendanceService_js_1.AttendanceService.getAllAttendance(organizationId, userId, role, email);
        res.status(200).json({ data: attendances });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAllAttendance = getAllAttendance;
const checkIn = async (req, res) => {
    try {
        const { employeeId, deviceInfo, overrideReason, lat, lng } = req.body;
        const { organizationId, email } = req.user || {};
        if (!organizationId || !email) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const ipAddress = Array.isArray(clientIP) ? clientIP[0] : clientIP;
        const attendance = await AttendanceService_js_1.AttendanceService.checkIn(organizationId, employeeId, email, ipAddress, deviceInfo, overrideReason, lat, lng);
        res.status(201).json({ data: attendance });
    }
    catch (error) {
        res.status(error.message === 'Attendance already recorded for today' || error.message.includes('already') ? 400 : 500).json({ message: error.message });
    }
};
exports.checkIn = checkIn;
const checkOut = async (req, res) => {
    try {
        const { id } = req.params;
        const { taskReportId } = req.body;
        const { organizationId, email } = req.user || {};
        if (!organizationId || !email) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const attendance = await AttendanceService_js_1.AttendanceService.checkOut(organizationId, id, email, taskReportId);
        res.status(200).json({ data: attendance });
    }
    catch (error) {
        res.status(error.message === 'Attendance record not found' || error.message.includes('not found') ? 404 : 500).json({ message: error.message });
    }
};
exports.checkOut = checkOut;
const verifyIP = async (req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;
    const isOfficeIP = ipString.includes('192.168.29.') || ipString === '127.0.0.1' || ipString === '::1';
    res.status(200).json({ data: { isOfficeIP, currentIP: ipString } });
};
exports.verifyIP = verifyIP;
const updateAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { loginTime, logoutTime, status } = req.body;
        const { organizationId, email } = req.user || {};
        if (!organizationId || !email) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const attendance = await AttendanceService_js_1.AttendanceService.updateAttendance(organizationId, id, email, loginTime, logoutTime, status);
        res.status(200).json({ data: attendance });
    }
    catch (error) {
        res.status(error.message === 'Attendance record not found' || error.message.includes('not found') ? 404 : 500).json({ message: error.message });
    }
};
exports.updateAttendance = updateAttendance;
