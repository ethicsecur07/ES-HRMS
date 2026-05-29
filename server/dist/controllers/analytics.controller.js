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
const Project_js_1 = require("../models/Project.js");
const Task_js_1 = require("../models/Task.js");
const index_js_1 = require("../constants/index.js");
const User_js_1 = require("../models/User.js");
const notification_service_js_1 = require("../services/notification.service.js");
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
        // Build financeData from Payroll: last 6 months with allocation breakdowns
        const financeMonths = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            financeMonths.push(d.toISOString().slice(0, 7)); // YYYY-MM
        }
        const formatMonthLabel = (m) => {
            const [year, mon] = m.split('-');
            return new Date(Number(year), Number(mon) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
        };
        const payrollDocs = await Payroll_js_1.Payroll.find({
            organizationId: new mongoose_1.default.Types.ObjectId(orgId),
            month: { $in: financeMonths },
        });
        let financeData = [];
        // Try building from real payroll data
        if (payrollDocs.length > 0) {
            financeData = financeMonths.map((m) => {
                const monthPayrolls = payrollDocs.filter((p) => p.month === m);
                const totalBase = monthPayrolls.reduce((sum, p) => sum + (p.baseSalary || 0), 0);
                const totalBonus = monthPayrolls.reduce((sum, p) => sum + (p.bonus || 0) + (p.overtime || 0) + (p.reimbursements || 0), 0);
                const totalTax = monthPayrolls.reduce((sum, p) => sum + (p.tax || 0), 0);
                const totalDeductions = monthPayrolls.reduce((sum, p) => sum + (p.deductions || 0) + (p.leaveDeductions || 0), 0);
                return {
                    month: formatMonthLabel(m),
                    allocations: [
                        { name: 'Base Salary', value: totalBase },
                        { name: 'Bonus & Extras', value: totalBonus },
                        { name: 'Tax', value: totalTax },
                        { name: 'Deductions', value: totalDeductions },
                    ].filter((a) => a.value > 0),
                };
            }).filter((m) => m.allocations.length > 0);
        }
        // Fallback: derive from Employee salaries if no payroll data exists
        if (financeData.length === 0) {
            const allActiveEmployees = await Employee_js_1.Employee.find({ isActive: true, organizationId: orgId }, { salary: 1 });
            const totalMonthlySalary = allActiveEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
            // Use employee salary sum, or estimate from count
            const baseCost = totalMonthlySalary > 0 ? totalMonthlySalary : (totalEmployees * 50000);
            financeData = financeMonths.slice(-3).map((m) => ({
                month: formatMonthLabel(m),
                allocations: [
                    { name: 'Base Salary', value: Math.round(baseCost * 0.70) },
                    { name: 'Bonus & Extras', value: Math.round(baseCost * 0.10) },
                    { name: 'Tax', value: Math.round(baseCost * 0.12) },
                    { name: 'Deductions', value: Math.round(baseCost * 0.08) },
                ],
            }));
        }
        // Build projectProductivity from Project + Task data
        const projects = await Project_js_1.Project.find({ organizationId: orgId })
            .populate('allocatedManagerId', 'name')
            .lean();
        const allOrgTasks = await Task_js_1.Task.find({ organizationId: orgId }).lean();
        const projectProductivity = projects.map((proj) => {
            const projTasks = allOrgTasks.filter((t) => t.projectId.toString() === proj._id.toString());
            const total = projTasks.length;
            const completed = projTasks.filter((t) => t.status === 'COMPLETED').length;
            const inProgress = projTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
            const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
            const inProgressPercent = total > 0 ? Math.round((inProgress / total) * 100) : 0;
            const manager = proj.allocatedManagerId;
            const managerName = manager?.name || 'Unassigned';
            return {
                id: proj._id,
                projectName: proj.name,
                managedBy: managerName,
                status: proj.status,
                totalTasks: total,
                inProgressPercent,
                completionPercent,
                teamSize: proj.teamMemberIds?.length || 0,
            };
        });
        const totalProjects = await Project_js_1.Project.countDocuments({ organizationId: orgId });
        const activeProjects = await Project_js_1.Project.countDocuments({ status: 'ACTIVE', organizationId: orgId });
        // Project Onboard Count: Count unique employees assigned to active projects
        const activeProjectsList = await Project_js_1.Project.find({ status: 'ACTIVE', organizationId: orgId }).select('teamMemberIds');
        const uniqueAssignedEmployees = new Set();
        activeProjectsList.forEach(proj => {
            if (proj.teamMemberIds) {
                proj.teamMemberIds.forEach(id => uniqueAssignedEmployees.add(id.toString()));
            }
        });
        const projectOnboardCount = uniqueAssignedEmployees.size;
        const projectAssignments = activeProjectsList.reduce((acc, proj) => acc + (proj.teamMemberIds?.length || 0), 0);
        // Group active employees by department and count
        // Match organizationId as both ObjectId and string to be resilient
        let employeeTrendsDepartmentWise = {};
        try {
            let orgObjectId = null;
            try {
                orgObjectId = new mongoose_1.default.Types.ObjectId(orgId.toString());
            }
            catch { /* not a valid ObjectId string */ }
            const matchStage = orgObjectId
                ? { $match: { isActive: true, $or: [{ organizationId: orgObjectId }, { organizationId: orgId.toString() }] } }
                : { $match: { isActive: true, organizationId: orgId.toString() } };
            const departmentTrendsResult = await Employee_js_1.Employee.aggregate([
                matchStage,
                { $group: { _id: '$department', employeeCount: { $sum: 1 } } }
            ]);
            console.log('[Analytics] departmentTrendsResult raw:', JSON.stringify(departmentTrendsResult));
            employeeTrendsDepartmentWise = departmentTrendsResult.reduce((acc, curr) => {
                const key = curr._id ? String(curr._id).trim() : 'Unassigned';
                acc[key] = (acc[key] || 0) + curr.employeeCount;
                return acc;
            }, {});
        }
        catch (deptErr) {
            console.error('[Analytics] Department trends aggregate failed:', deptErr?.message);
        }
        res.status(200).json({
            totalEmployees,
            presentToday,
            wfhToday,
            absentToday,
            pendingApprovals: pendingApprovalCounts.total,
            pendingApprovalBreakdown: pendingApprovalCounts,
            monthlyPayrollCost,
            attendanceTrends,
            departmentBreakdown,
            deptsData: departmentBreakdown,
            overallProductivity,
            financeData,
            projectProductivity,
            totalProjects,
            activeProjects,
            projectOnboardCount,
            projectAssignments,
            employeeTrendsDepartmentWise,
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
            salaryCycleStartDay: org.settings?.salaryCycleStartDay || 1,
            officeWiFiIPs: org.settings?.allowedIPs || ['127.0.0.1', '::1'],
            adminEmail: org.settings?.adminEmail || '',
            activeWorkdays: org.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            loginApprovalRoles: org.settings?.loginApprovalRoles || ['ADMIN'],
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
        const oldSalaryCycleStartDay = org.settings?.salaryCycleStartDay || 1;
        const oldLeaveLimit = org.settings?.monthlyLeaveLimit || 2;
        const oldPermissionHours = org.settings?.monthlyPermissionHours || 3;
        const { companyName, monthlyLeaveLimit, monthlyWFHLimit, monthlyPermissionHours, salaryCycleStartDay, officeWiFiIPs, adminEmail, activeWorkdays, loginApprovalRoles } = req.body;
        const newSalaryCycleStartDay = Number(salaryCycleStartDay) || 1;
        const newLeaveLimit = Number(monthlyLeaveLimit) || 2;
        const newPermissionHours = Number(monthlyPermissionHours) || 3;
        const getOrdinal = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return s[(v - 20) % 10] || s[v] || s[0];
        };
        const changes = [];
        if (newSalaryCycleStartDay !== oldSalaryCycleStartDay) {
            changes.push(`Salary cycle start day updated to the ${newSalaryCycleStartDay}${getOrdinal(newSalaryCycleStartDay)} day of the month`);
        }
        if (newLeaveLimit !== oldLeaveLimit) {
            changes.push(`Monthly leave limit updated to ${newLeaveLimit} days`);
        }
        if (newPermissionHours !== oldPermissionHours) {
            changes.push(`Monthly permission limit updated to ${newPermissionHours} hours`);
        }
        if (companyName)
            org.name = companyName;
        // Use field-level mutations to preserve other settings (customHolidays, activeWorkdays, theme, etc.)
        if (!org.settings)
            org.settings = {};
        org.settings.monthlyLeaveLimit = newLeaveLimit;
        org.settings.monthlyWFHLimit = Number(monthlyWFHLimit) || org.settings.monthlyWFHLimit || 1;
        org.settings.monthlyPermissionHours = newPermissionHours;
        org.settings.salaryCycleStartDay = newSalaryCycleStartDay;
        org.settings.allowedIPs = officeWiFiIPs?.length ? officeWiFiIPs : (org.settings.allowedIPs || ['127.0.0.1', '::1']);
        if (adminEmail !== undefined) {
            org.settings.adminEmail = adminEmail;
        }
        if (activeWorkdays && Array.isArray(activeWorkdays)) {
            org.settings.activeWorkdays = activeWorkdays;
        }
        if (loginApprovalRoles && Array.isArray(loginApprovalRoles)) {
            org.settings.loginApprovalRoles = loginApprovalRoles;
        }
        // Tell Mongoose the nested settings object has changed
        org.markModified('settings');
        await org.save();
        if (changes.length > 0) {
            const activeUsers = await User_js_1.User.find({ organizationId: org._id, isActive: true });
            const notificationTitle = "Company Policy Update Alert";
            const notificationMessage = `The administrator has updated the company policies:\n• ${changes.join('\n• ')}`;
            for (const u of activeUsers) {
                await notification_service_js_1.notificationService.dispatchNotification({
                    organizationId: org._id,
                    recipientId: u._id.toString(),
                    title: notificationTitle,
                    message: notificationMessage,
                    channels: ['IN_APP'],
                    type: 'POLICY_UPDATE',
                });
            }
        }
        res.status(200).json({ message: 'Settings updated successfully', settings: req.body });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateSettings = updateSettings;
