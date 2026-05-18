"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeTasks = exports.getTaskReports = exports.submitTaskReport = void 0;
const TaskReport_js_1 = require("../models/TaskReport.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const submitTaskReport = async (req, res) => {
    try {
        const taskReport = await TaskReport_js_1.TaskReport.create(req.body);
        await (0, auditLog_service_js_1.createAuditLog)('TASK_REPORT_SUBMIT', req.user?.email || 'Employee', 'TASK', taskReport.id, `Submitted daily task report for ${taskReport.date}`);
        res.status(201).json({ taskReport });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.submitTaskReport = submitTaskReport;
const getTaskReports = async (req, res) => {
    try {
        const taskReports = await TaskReport_js_1.TaskReport.find().populate('employeeId').sort({ date: -1 });
        res.status(200).json({ taskReports });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTaskReports = getTaskReports;
const getEmployeeTasks = async (req, res) => {
    try {
        const taskReports = await TaskReport_js_1.TaskReport.find({ employeeId: req.params.employeeId }).sort({ date: -1 });
        res.status(200).json({ taskReports });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getEmployeeTasks = getEmployeeTasks;
