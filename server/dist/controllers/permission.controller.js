"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePermissionStatus = exports.getPermissions = exports.applyPermission = void 0;
const Permission_js_1 = require("../models/Permission.js");
const Employee_js_1 = require("../models/Employee.js");
const User_js_1 = require("../models/User.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const applyPermission = async (req, res) => {
    const { employeeId, date, startTime, endTime, totalHours, reason } = req.body;
    try {
        const perm = await Permission_js_1.Permission.create({
            employeeId,
            date,
            startTime,
            endTime,
            totalHours,
            reason,
        });
        await (0, auditLog_service_js_1.createAuditLog)('PERMISSION_APPLY', req.user?.email || 'Employee', 'PERMISSION', perm.id, `Requested ${totalHours} hrs permission on ${date}`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const notifData = {
                title: 'New Permission Request',
                message: `Employee requested ${totalHours} hrs permission on ${date}.`,
                type: 'PERMISSION',
                recipientId: 'admin-hr',
            };
            io.to('ADMIN').emit('receive_notification', notifData);
            io.to('HR').emit('receive_notification', notifData);
        }
        res.status(201).json({ permissionRequest: perm });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.applyPermission = applyPermission;
const getPermissions = async (req, res) => {
    try {
        const permissions = await Permission_js_1.Permission.find().populate('employeeId').sort({ createdAt: -1 });
        res.status(200).json({ permissions, permissionRequests: permissions });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPermissions = getPermissions;
const updatePermissionStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const perm = await Permission_js_1.Permission.findByIdAndUpdate(id, { approvalStatus: status, approvedBy: req.user?.id }, { new: true }).populate('employeeId');
        if (!perm) {
            res.status(404).json({ message: 'Permission request not found' });
            return;
        }
        if (status === 'APPROVED') {
            await Employee_js_1.Employee.findByIdAndUpdate(perm.employeeId, { $inc: { permissionHoursBalance: -perm.totalHours } });
        }
        await (0, auditLog_service_js_1.createAuditLog)('PERMISSION_STATUS_UPDATE', req.user?.email || 'HR/Admin', 'PERMISSION', perm.id, `Updated permission status to ${status}`);
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            const empUser = await User_js_1.User.findOne({ employeeId: perm.employeeId });
            const notifData = {
                title: `Permission Request ${status}`,
                message: `Your permission request for ${perm.date} (${perm.totalHours} hrs) has been ${status.toLowerCase()}.`,
                type: 'PERMISSION',
                recipientId: empUser ? empUser.id : 'employee',
            };
            if (empUser) {
                io.to(empUser.id).emit('receive_notification', notifData);
            }
            io.to('EMPLOYEE').emit('receive_notification', notifData);
        }
        res.status(200).json({ permissionRequest: perm });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updatePermissionStatus = updatePermissionStatus;
