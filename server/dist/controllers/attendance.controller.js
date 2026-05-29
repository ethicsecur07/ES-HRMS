"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitPendingReport = exports.getPendingReports = exports.updateAttendance = exports.verifyIP = exports.checkOut = exports.checkIn = exports.getAllAttendance = exports.getTodayAttendance = void 0;
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
        // Build a warning message if the check-in is late (only 1st late is allowed; 2nd is blocked)
        let warning = undefined;
        if (attendance.isLate) {
            const now = new Date();
            const mongoose = (await import('mongoose')).default;
            const empId = new mongoose.Types.ObjectId(employeeId);
            const orgId = new mongoose.Types.ObjectId(organizationId);
            const Attendance = (await import('../models/Attendance.js')).Attendance;
            const Organization = (await import('../models/Organization.js')).Organization;
            const { AttendanceService } = await import('../domains/attendance-engine/services/AttendanceService.js');
            const org = await Organization.findOne({ _id: orgId }).select('settings.salaryCycleStartDay');
            const startDay = org?.settings?.salaryCycleStartDay ?? 10;
            const { cycleStart, cycleEnd } = AttendanceService.getSalaryCycleDates(now, startDay);
            const lateCountThisCycle = await Attendance.countDocuments({
                organizationId: orgId,
                employeeId: empId,
                isLate: true,
                date: { $gte: cycleStart, $lte: cycleEnd }
            });
            warning =
                `⏰ Come fast! Late check-in recorded ` +
                    `(${lateCountThisCycle === 1 ? '1st' : `${lateCountThisCycle}th`} time this salary cycle ${cycleStart} – ${cycleEnd}). ` +
                    `Your next late check-in this cycle will be counted as absent — please apply for leave!`;
        }
        res.status(201).json({
            data: {
                ...(attendance.toObject ? attendance.toObject() : attendance),
                warning
            }
        });
    }
    catch (error) {
        const msg = error.message || '';
        const isAlready = msg.includes('already');
        const isBlocked = msg.includes('blocked');
        res.status(isAlready ? 400 : isBlocked ? 403 : 500).json({ message: msg });
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
const getPendingReports = async (req, res) => {
    try {
        const { organizationId, email, role, id: userId } = req.user || {};
        if (!organizationId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const User = (await import('../models/User.js')).User;
        const Employee = (await import('../models/Employee.js')).Employee;
        const Attendance = (await import('../models/Attendance.js')).Attendance;
        const user = await User.findOne({ _id: userId, organizationId });
        let employeeId = user?.employeeId;
        if (user && !employeeId) {
            const employee = await Employee.findOne({ email, organizationId });
            if (employee)
                employeeId = employee._id;
        }
        if (!employeeId) {
            res.status(200).json({ data: [] });
            return;
        }
        const pending = await Attendance.find({
            organizationId,
            employeeId,
            pendingReportUpdate: true
        }).sort({ date: -1 });
        res.status(200).json({ data: pending });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPendingReports = getPendingReports;
const submitPendingReport = async (req, res) => {
    try {
        const { organizationId, email, role, id: userId } = req.user || {};
        if (!organizationId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { attendanceId, completedTasks, inProgressTasks, pendingTasks, blockers, tomorrowPlan } = req.body;
        if (!attendanceId || !completedTasks) {
            res.status(400).json({ message: 'Attendance ID and completed tasks are required.' });
            return;
        }
        const User = (await import('../models/User.js')).User;
        const Employee = (await import('../models/Employee.js')).Employee;
        const Attendance = (await import('../models/Attendance.js')).Attendance;
        const TaskReport = (await import('../models/TaskReport.js')).TaskReport;
        const createAuditLog = (await import('../services/auditLog.service.js')).createAuditLog;
        const user = await User.findOne({ _id: userId, organizationId });
        let employeeId = user?.employeeId;
        if (user && !employeeId) {
            const employee = await Employee.findOne({ email, organizationId });
            if (employee)
                employeeId = employee._id;
        }
        if (!employeeId) {
            res.status(400).json({ message: 'Employee profile not found.' });
            return;
        }
        const att = await Attendance.findOne({
            _id: attendanceId,
            employeeId,
            organizationId,
            pendingReportUpdate: true
        });
        if (!att) {
            res.status(404).json({ message: 'Pending attendance record not found.' });
            return;
        }
        // Create the retroactive TaskReport
        const taskReport = await TaskReport.create({
            organizationId,
            employeeId,
            date: att.date,
            completedTasks,
            inProgressTasks: inProgressTasks || '',
            pendingTasks: pendingTasks || '',
            blockers: blockers || 'None',
            tomorrowPlan: tomorrowPlan || '',
            submittedAt: new Date()
        });
        // Update Attendance record
        att.pendingReportUpdate = false;
        att.taskSubmitted = true;
        await att.save();
        await createAuditLog('TASK_REPORT_SUBMIT_RETROACTIVE', email || 'Employee', 'TASK', taskReport.id, `Submitted retroactive task report for forgot checkout date ${att.date}`, organizationId);
        res.status(200).json({ message: 'Retroactive report submitted successfully.', data: taskReport });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.submitPendingReport = submitPendingReport;
