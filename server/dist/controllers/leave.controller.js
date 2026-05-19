"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLeaveStatus = exports.getLeaves = exports.applyLeave = void 0;
const Leave_js_1 = require("../models/Leave.js");
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const applyLeave = async (req, res) => {
    try {
        let employeeId = req.body.employeeId;
        if (req.user) {
            const user = await User_js_1.User.findById(req.user.id);
            if (user && user.role === 'EMPLOYEE') {
                if (user.employeeId) {
                    employeeId = user.employeeId;
                }
                else {
                    const employee = await Employee_js_1.Employee.findOne({ email: user.email });
                    if (employee) {
                        employeeId = employee._id;
                    }
                }
            }
        }
        if (!employeeId) {
            res.status(400).json({ message: 'Employee profile not found for this user.' });
            return;
        }
        const leave = await Leave_js_1.Leave.create({
            ...req.body,
            employeeId,
        });
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_APPLY', req.user?.email || 'Employee', 'LEAVE', leave.id, `Applied for ${leave.leaveType} (${leave.totalDays} days)`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const notifData = {
                _id: `leave-pending-${leave.id}`,
                title: 'New Leave Request',
                message: `Employee applied for ${leave.leaveType} (${leave.totalDays} days).`,
                type: 'LEAVE',
                recipientId: 'admin-hr',
            };
            io.to('ADMIN').emit('receive_notification', notifData);
            io.to('HR').emit('receive_notification', notifData);
        }
        res.status(201).json({ leaveRequest: leave });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.applyLeave = applyLeave;
const getLeaves = async (req, res) => {
    try {
        const authReq = req;
        let query = { leaveType: { $ne: 'WFH' } };
        if (authReq.user && authReq.user.role === 'EMPLOYEE') {
            const user = await User_js_1.User.findById(authReq.user.id);
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email: user.email });
                if (employee) {
                    employeeId = employee._id;
                }
            }
            if (employeeId) {
                query.employeeId = employeeId;
            }
            else {
                res.status(200).json({ leaveRequests: [] });
                return;
            }
        }
        const leaveRequests = await Leave_js_1.Leave.find(query).populate('employeeId').sort({ createdAt: -1 });
        res.status(200).json({ leaveRequests });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getLeaves = getLeaves;
const updateLeaveStatus = async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    try {
        const leave = await Leave_js_1.Leave.findByIdAndUpdate(id, { status, rejectionReason, approvedBy: req.user?.id }, { new: true }).populate('employeeId');
        if (!leave) {
            res.status(404).json({ message: 'Leave request not found' });
            return;
        }
        if (status === 'APPROVED' && leave.leaveType === 'Casual Leave') {
            await Employee_js_1.Employee.findByIdAndUpdate(leave.employeeId, { $inc: { leaveBalance: -leave.totalDays } });
        }
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_STATUS_UPDATE', req.user?.email || 'HR/Admin', 'LEAVE', leave.id, `Updated leave status to ${status}`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const empId = leave.employeeId._id || leave.employeeId;
            const empUser = await User_js_1.User.findOne({ employeeId: empId });
            const notifData = {
                _id: `leave-status-${leave.id}-${status}`,
                title: `Leave Request ${status}`,
                message: `Your leave request for ${leave.leaveType} (${leave.totalDays} days) has been ${status.toLowerCase()}.`,
                type: 'LEAVE',
                recipientId: empUser ? empUser.id : 'employee',
            };
            if (empUser) {
                io.to(empUser.id).emit('receive_notification', notifData);
            }
        }
        res.status(200).json({ leaveRequest: leave });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateLeaveStatus = updateLeaveStatus;
