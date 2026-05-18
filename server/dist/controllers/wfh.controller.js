"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWFHStatus = exports.getWFHRequests = exports.applyWFH = void 0;
const Leave_js_1 = require("../models/Leave.js");
const Employee_js_1 = require("../models/Employee.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
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
        res.status(200).json({ wfhRequest: wfh });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateWFHStatus = updateWFHStatus;
