"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectReport = exports.getLeaveReport = exports.getExpenseReport = exports.getPerformanceReport = exports.getPayrollReport = exports.getAttendanceReport = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Attendance_js_1 = require("../models/Attendance.js");
const Payroll_js_1 = require("../models/Payroll.js");
const TaskReport_js_1 = require("../models/TaskReport.js");
const Expense_js_1 = require("../models/Expense.js");
const Leave_js_1 = require("../models/Leave.js");
const Project_js_1 = require("../models/Project.js");
const getAttendanceReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        const report = await Attendance_js_1.Attendance.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: '$date',
                    present: { $sum: { $cond: [{ $eq: ['$status', 'OFFICE'] }, 1, 0] } },
                    wfh: { $sum: { $cond: [{ $eq: ['$status', 'WFH'] }, 1, 0] } },
                    late: { $sum: { $cond: ['$isLate', 1, 0] } },
                    totalHours: { $sum: { $ifNull: ['$workingHours', 0] } }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 30 }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAttendanceReport = getAttendanceReport;
const getPayrollReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        const report = await Payroll_js_1.Payroll.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: '$month',
                    totalGross: { $sum: '$grossSalary' },
                    totalNet: { $sum: '$finalSalary' },
                    totalDeductions: { $sum: { $add: ['$taxDeducted', '$leaveDeducted'] } }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 12 }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getPayrollReport = getPayrollReport;
const getPerformanceReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        // Aggregate by employee
        const report = await TaskReport_js_1.TaskReport.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: '$employeeId',
                    totalReports: { $sum: 1 },
                    lastReportDate: { $max: '$date' }
                }
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'employee'
                }
            },
            { $unwind: '$employee' },
            {
                $project: {
                    employeeName: '$employee.fullName',
                    department: '$employee.department',
                    totalReports: 1,
                    lastReportDate: 1
                }
            },
            { $sort: { totalReports: -1 } }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getPerformanceReport = getPerformanceReport;
const getExpenseReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        const report = await Expense_js_1.Expense.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: { category: '$category', status: '$status' },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    category: '$_id.category',
                    status: '$_id.status',
                    totalAmount: 1,
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getExpenseReport = getExpenseReport;
const getLeaveReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        const report = await Leave_js_1.Leave.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: { leaveType: '$leaveType', status: '$status' },
                    totalDays: { $sum: '$numberOfDays' },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    leaveType: '$_id.leaveType',
                    status: '$_id.status',
                    totalDays: 1,
                    count: 1,
                    _id: 0
                }
            }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getLeaveReport = getLeaveReport;
const getProjectReport = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Missing org context' });
            return;
        }
        const report = await Project_js_1.Project.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalBudget: { $sum: '$budget' },
                    projects: { $push: { name: '$name', budget: '$budget' } }
                }
            }
        ]);
        res.status(200).json({ success: true, report });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getProjectReport = getProjectReport;
