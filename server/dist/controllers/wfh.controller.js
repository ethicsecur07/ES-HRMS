"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWFHStatus = exports.getWFHRequests = exports.applyWFH = void 0;
const Leave_js_1 = require("../models/Leave.js");
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const applyWFH = async (req, res) => {
    const { employeeId, date, reason, expectedTasks } = req.body;
    try {
        const wfh = await Leave_js_1.Leave.create({
            employeeId,
            leaveType: 'WFH',
            startDate: date,
            endDate: date,
            totalDays: 1,
            reason,
            expectedTasks,
        });
        await (0, auditLog_service_js_1.createAuditLog)('WFH_APPLY', req.user?.email || 'Employee', 'WFH', wfh.id, `Requested WFH for ${date}`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const notifData = {
                title: 'New WFH Request',
                message: `Employee requested WFH for ${date}.`,
                type: 'WFH',
                recipientId: 'admin-hr',
            };
            io.to('ADMIN').emit('receive_notification', notifData);
            io.to('HR').emit('receive_notification', notifData);
        }
        res.status(201).json({ wfhRequest: wfh });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.applyWFH = applyWFH;
const getWFHRequests = async (req, res) => {
    try {
        const wfhRequests = await Leave_js_1.Leave.find({ leaveType: 'WFH' }).populate('employeeId').sort({ createdAt: -1 });
        res.status(200).json({ wfhRequests });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getWFHRequests = getWFHRequests;
const updateWFHStatus = async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    try {
        const wfh = await Leave_js_1.Leave.findByIdAndUpdate(id, { status, rejectionReason, approvedBy: req.user?.id }, { new: true }).populate('employeeId');
        if (!wfh) {
            res.status(404).json({ message: 'WFH request not found' });
            return;
        }
        if (status === 'APPROVED') {
            await Employee_js_1.Employee.findByIdAndUpdate(wfh.employeeId, { $inc: { wfhBalance: -1 } });
        }
        await (0, auditLog_service_js_1.createAuditLog)('WFH_STATUS_UPDATE', req.user?.email || 'HR/Admin', 'WFH', wfh.id, `Updated WFH status to ${status}`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const empUser = await User_js_1.User.findOne({ employeeId: wfh.employeeId });
            const notifData = {
                title: `WFH Request ${status}`,
                message: `Your WFH request for ${wfh.startDate} has been ${status.toLowerCase()}.`,
                type: 'WFH',
                recipientId: empUser ? empUser.id : 'employee',
            };
            if (empUser) {
                io.to(empUser.id).emit('receive_notification', notifData);
            }
            io.to('EMPLOYEE').emit('receive_notification', notifData);
        }
        res.status(200).json({ wfhRequest: wfh });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateWFHStatus = updateWFHStatus;
