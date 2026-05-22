"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeTasks = exports.getTaskReports = exports.submitTaskReport = void 0;
const TaskReport_js_1 = require("../models/TaskReport.js");
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const submitTaskReport = async (req, res) => {
    try {
        const taskReport = await TaskReport_js_1.TaskReport.create({
            ...req.body,
            organizationId: req.user?.organizationId,
        });
        await (0, auditLog_service_js_1.createAuditLog)('TASK_REPORT_SUBMIT', req.user?.email || 'Employee', 'TASK', taskReport.id, `Submitted daily task report for ${taskReport.date}`, req.user?.organizationId);
        res.status(201).json({ taskReport });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.submitTaskReport = submitTaskReport;
const getTaskReports = async (req, res) => {
    try {
        const authReq = req;
        const query = { organizationId: authReq.user?.organizationId };
        if (authReq.user && authReq.user.role === 'EMPLOYEE') {
            const user = await User_js_1.User.findOne({ _id: authReq.user.id, organizationId: authReq.user.organizationId });
            let employeeId = user?.employeeId;
            if (user && !employeeId) {
                const employee = await Employee_js_1.Employee.findOne({ email: user.email, organizationId: authReq.user.organizationId });
                if (employee) {
                    employeeId = employee._id;
                }
            }
            if (employeeId) {
                query.employeeId = employeeId;
            }
            else {
                res.status(200).json({ taskReports: [] });
                return;
            }
        }
        const taskReports = await TaskReport_js_1.TaskReport.find(query).populate('employeeId').sort({ date: -1 });
        res.status(200).json({ taskReports });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTaskReports = getTaskReports;
const getEmployeeTasks = async (req, res) => {
    try {
        const authReq = req;
        const taskReports = await TaskReport_js_1.TaskReport.find({
            employeeId: req.params.employeeId,
            organizationId: authReq.user?.organizationId,
        }).sort({ date: -1 });
        res.status(200).json({ taskReports });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployeeTasks = getEmployeeTasks;
