"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getSettings = exports.getAuditLogs = exports.getDashboardStats = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const Attendance_js_1 = require("../models/Attendance.js");
const Payroll_js_1 = require("../models/Payroll.js");
const AuditLog_js_1 = require("../models/AuditLog.js");
const TaskReport_js_1 = require("../models/TaskReport.js");
const Organization_js_1 = require("../models/Organization.js");
const index_js_1 = require("../constants/index.js");
const LeaveAnalyticsService_js_1 = require("../domains/leave-engine/services/LeaveAnalyticsService.js");
const countTasks = (text) => {
    if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none' || text.trim().toLowerCase() === 'n/a' || text.trim() === '-')
        return 0;
    return text.split(/[\n,;]+/).filter(item => item.trim().length > 0).length;
};
const getDashboardStats = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization context is missing' });
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const totalEmployees = await Employee_js_1.Employee.countDocuments({ isActive: true, organizationId: orgId });
        const presentToday = await Attendance_js_1.Attendance.countDocuments({ date: today, status: 'OFFICE', organizationId: orgId });
        const wfhToday = await Attendance_js_1.Attendance.countDocuments({ date: today, status: 'WFH', organizationId: orgId });
        const absentToday = Math.max(0, totalEmployees - (presentToday + wfhToday));
        // Accurate pending approvals: Leave + WFH + Permission
        const pendingApprovalCounts = await LeaveAnalyticsService_js_1.LeaveAnalyticsService.getPendingApprovalCount(orgId);
        const currentMonth = new Date().toISOString().slice(0, 7);
        const payrollResult = await Payroll_js_1.Payroll.aggregate([
            { $match: { month: currentMonth, organizationId: new mongoose_1.default.Types.ObjectId(orgId) } },
            { $group: { _id: null, totalCost: { $sum: '$finalSalary' } } },
        ]);
        const monthlyPayrollCost = payrollResult[0]?.totalCost || 0;
        // Calculate real weekly trend from DB (last 6 days)
        const last6DaysStr = [];
        const attendanceTrends = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            last6DaysStr.push({ dateStr, dayName });
        }
        const recentAttendance = await Attendance_js_1.Attendance.find({
            date: { $in: last6DaysStr.map(d => d.dateStr) },
            organizationId: orgId,
        });
        for (const { dateStr, dayName } of last6DaysStr) {
            const present = recentAttendance.filter(a => a.date === dateStr && a.status === 'OFFICE').length;
            const wfh = recentAttendance.filter(a => a.date === dateStr && a.status === 'WFH').length;
            attendanceTrends.push({ date: dayName, present, wfh });
        }
        // Calculate Department Productivity & Overall Productivity using ONLY DB Data
        const activeEmployees = await Employee_js_1.Employee.find({ isActive: true, organizationId: orgId });
        const allTaskReports = await TaskReport_js_1.TaskReport.find({ organizationId: orgId });
        let totalCompanyEfficiencySum = 0;
        let totalCompanyReportsCount = 0;
        const targetDepartments = [index_js_1.DEPARTMENTS.DEV, index_js_1.DEPARTMENTS.DES, index_js_1.DEPARTMENTS.BDE, index_js_1.DEPARTMENTS.DME];
        const departmentBreakdown = targetDepartments.map((deptName) => {
            // Find active employees in this department
            const deptEmployees = activeEmployees.filter(emp => emp.department === deptName);
            const deptEmployeeIds = deptEmployees.map(emp => emp._id.toString());
            // Find task reports submitted by employees in this department
            const deptReports = allTaskReports.filter(report => deptEmployeeIds.includes(report.employeeId.toString()));
            let deptEfficiencySum = 0;
            deptReports.forEach(report => {
                const completed = countTasks(report.completedTasks);
                const inProgress = countTasks(report.inProgressTasks);
                const pending = countTasks(report.pendingTasks);
                const total = completed + inProgress + pending;
                const efficiency = total > 0 ? (completed / total) * 100 : 0;
                deptEfficiencySum += efficiency;
                totalCompanyEfficiencySum += efficiency;
                totalCompanyReportsCount += 1;
            });
            const avgProductivity = deptReports.length > 0 ? Math.round(deptEfficiencySum / deptReports.length) : 0;
            return {
                name: deptName,
                count: deptEmployees.length,
                avgProductivity,
            };
        });
        const overallProductivity = totalCompanyReportsCount > 0
            ? Math.round((totalCompanyEfficiencySum / totalCompanyReportsCount) * 10) / 10
            : 0;
        res.status(200).json({
            totalEmployees,
            presentToday,
            wfhToday,
            absentToday,
            pendingApprovals: pendingApprovalCounts.total,
            pendingApprovalBreakdown: pendingApprovalCounts, // leaves, wfh, permissions
            monthlyPayrollCost,
            attendanceTrends,
            departmentBreakdown,
            overallProductivity,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDashboardStats = getDashboardStats;
const getAuditLogs = async (req, res) => {
    try {
        const authReq = req;
        const auditLogs = await AuditLog_js_1.AuditLog.find({ organizationId: authReq.user?.organizationId })
            .sort({ timestamp: -1 })
            .limit(100);
        res.status(200).json({ auditLogs });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getAuditLogs = getAuditLogs;
const getSettings = async (req, res) => {
    try {
        const authReq = req;
        const org = await Organization_js_1.Organization.findById(authReq.user?.organizationId);
        if (!org) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }
        const settingsData = {
            companyName: org.name,
            monthlyLeaveLimit: org.settings?.monthlyLeaveLimit || 2,
            monthlyWFHLimit: org.settings?.monthlyWFHLimit || 1,
            monthlyPermissionHours: org.settings?.monthlyPermissionHours || 3,
            officeWiFiIPs: org.settings?.allowedIPs || ['127.0.0.1', '::1'],
        };
        res.status(200).json({
            ...settingsData,
            settings: settingsData,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const authReq = req;
        const org = await Organization_js_1.Organization.findById(authReq.user?.organizationId);
        if (!org) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }
        const { companyName, monthlyLeaveLimit, monthlyWFHLimit, monthlyPermissionHours, officeWiFiIPs } = req.body;
        if (companyName)
            org.name = companyName;
        org.settings = {
            monthlyLeaveLimit: Number(monthlyLeaveLimit) || org.settings?.monthlyLeaveLimit || 2,
            monthlyWFHLimit: Number(monthlyWFHLimit) || org.settings?.monthlyWFHLimit || 1,
            monthlyPermissionHours: Number(monthlyPermissionHours) || org.settings?.monthlyPermissionHours || 3,
            allowedIPs: officeWiFiIPs || org.settings?.allowedIPs || ['127.0.0.1', '::1'],
        };
        await org.save();
        res.status(200).json({ message: 'Settings updated successfully', settings: req.body });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateSettings = updateSettings;
