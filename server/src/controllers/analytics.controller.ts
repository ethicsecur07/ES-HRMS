import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Attendance } from '../models/Attendance.js';
import { Leave } from '../models/Leave.js';
import { Payroll } from '../models/Payroll.js';
import { AuditLog } from '../models/AuditLog.js';
import { TaskReport } from '../models/TaskReport.js';
import { Organization } from '../models/Organization.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { DEPARTMENTS } from '../constants/index.js';
import { AuthRequest } from '../types/index.js';
import { LeaveAnalyticsService } from '../domains/leave-engine/services/LeaveAnalyticsService.js';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { notificationService } from '../services/notification.service.js';


const countTasks = (text?: string): number => {
  if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none' || text.trim().toLowerCase() === 'n/a' || text.trim() === '-') return 0;
  return text.split(/[\n,;]+/).filter(item => item.trim().length > 0).length;
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing' });
      return;
    }
    const today = new Date().toISOString().split('T')[0];

    const totalEmployees = await Employee.countDocuments({ isActive: true, organizationId: orgId });
    const presentToday = await Attendance.countDocuments({ date: today, status: 'OFFICE', organizationId: orgId });
    const wfhToday = await Attendance.countDocuments({ date: today, status: 'WFH', organizationId: orgId });
    const absentToday = Math.max(0, totalEmployees - (presentToday + wfhToday));

    // Accurate pending approvals: Leave + WFH + Permission
    const pendingApprovalCounts = await LeaveAnalyticsService.getPendingApprovalCount(orgId);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const payrollResult = await Payroll.aggregate([
      { $match: { month: currentMonth, organizationId: new mongoose.Types.ObjectId(orgId) } },
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

    const recentAttendance = await Attendance.find({
      date: { $in: last6DaysStr.map(d => d.dateStr) },
      organizationId: orgId,
    });
    
    for (const { dateStr, dayName } of last6DaysStr) {
      const present = recentAttendance.filter(a => a.date === dateStr && a.status === 'OFFICE').length;
      const wfh = recentAttendance.filter(a => a.date === dateStr && a.status === 'WFH').length;
      attendanceTrends.push({ date: dayName, present, wfh });
    }

    // Calculate Department Productivity & Overall Productivity using ONLY DB Data
    const activeEmployees = await Employee.find({ isActive: true, organizationId: orgId });
    const allTaskReports = await TaskReport.find({ organizationId: orgId });

    let totalCompanyEfficiencySum = 0;
    let totalCompanyReportsCount = 0;

    const targetDepartments = [DEPARTMENTS.DEV, DEPARTMENTS.DES, DEPARTMENTS.BDE, DEPARTMENTS.DME];

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
    const financeMonths: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      financeMonths.push(d.toISOString().slice(0, 7)); // YYYY-MM
    }

    const formatMonthLabel = (m: string) => {
      const [year, mon] = m.split('-');
      return new Date(Number(year), Number(mon) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    };

    const payrollDocs = await Payroll.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      month: { $in: financeMonths },
    });

    let financeData: Array<{ month: string; allocations: Array<{ name: string; value: number }> }> = [];

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
      const allActiveEmployees = await Employee.find(
        { isActive: true, organizationId: orgId },
        { salary: 1 }
      );
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
    const projects = await Project.find({ organizationId: orgId })
      .populate('allocatedManagerId', 'name')
      .lean();

    const allOrgTasks = await Task.find({ organizationId: orgId }).lean();

    const projectProductivity = projects.map((proj) => {
      const projTasks = allOrgTasks.filter(
        (t) => t.projectId.toString() === proj._id.toString()
      );
      const total = projTasks.length;
      const completed = projTasks.filter((t) => t.status === 'COMPLETED').length;
      const inProgress = projTasks.filter(
        (t) => t.status === 'IN_PROGRESS' || t.status === 'REVIEW'
      ).length;

      const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      const inProgressPercent = total > 0 ? Math.round((inProgress / total) * 100) : 0;

      const manager = proj.allocatedManagerId as any;
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
    const totalProjects = await Project.countDocuments({ organizationId: orgId });
    const activeProjects = await Project.countDocuments({ status: 'ACTIVE', organizationId: orgId });

    // Project Onboard Count: Count unique employees assigned to active projects
    const activeProjectsList = await Project.find({ status: 'ACTIVE', organizationId: orgId }).select('teamMemberIds');
    const uniqueAssignedEmployees = new Set<string>();
    activeProjectsList.forEach(proj => {
      if (proj.teamMemberIds) {
        proj.teamMemberIds.forEach(id => uniqueAssignedEmployees.add(id.toString()));
      }
    });
    const projectOnboardCount = uniqueAssignedEmployees.size;
    const projectAssignments = activeProjectsList.reduce((acc, proj) => acc + (proj.teamMemberIds?.length || 0), 0);

    // Group active employees by department and count
    // Match organizationId as both ObjectId and string to be resilient
    let employeeTrendsDepartmentWise: Record<string, number> = {};
    try {
      let orgObjectId: mongoose.Types.ObjectId | null = null;
      try { orgObjectId = new mongoose.Types.ObjectId(orgId.toString()); } catch { /* not a valid ObjectId string */ }

      const matchStage = orgObjectId
        ? { $match: { isActive: true, $or: [{ organizationId: orgObjectId }, { organizationId: orgId.toString() }] } }
        : { $match: { isActive: true, organizationId: orgId.toString() } };

      const departmentTrendsResult = await Employee.aggregate([
        matchStage,
        { $group: { _id: '$department', employeeCount: { $sum: 1 } } }
      ]);

      console.log('[Analytics] departmentTrendsResult raw:', JSON.stringify(departmentTrendsResult));

      employeeTrendsDepartmentWise = departmentTrendsResult.reduce((acc: Record<string, number>, curr) => {
        const key = curr._id ? String(curr._id).trim() : 'Unassigned';
        acc[key] = (acc[key] || 0) + curr.employeeCount;
        return acc;
      }, {});
    } catch (deptErr: any) {
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const auditLogs = await AuditLog.find({ organizationId: authReq.user?.organizationId })
      .sort({ timestamp: -1 })
      .limit(100);
    res.status(200).json({ auditLogs });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const org = await Organization.findById(authReq.user?.organizationId);
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
      payrollCycleStartDay: org.settings?.payrollCycleStartDay || 1,
    };
    res.status(200).json({
      ...settingsData,
      settings: settingsData,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    const org = await Organization.findById(orgId);
    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }
    const { companyName, monthlyLeaveLimit, monthlyWFHLimit, monthlyPermissionHours, officeWiFiIPs, payrollCycleStartDay } = req.body;
    if (companyName) org.name = companyName;
    
    const finalLeaveLimit = Number(monthlyLeaveLimit) || org.settings?.monthlyLeaveLimit || 2;
    const finalWFHLimit = Number(monthlyWFHLimit) || org.settings?.monthlyWFHLimit || 1;
    const finalPermissionHours = Number(monthlyPermissionHours) || org.settings?.monthlyPermissionHours || 3;
    const finalPayrollCycleStartDay = Number(payrollCycleStartDay) || org.settings?.payrollCycleStartDay || 1;
    const cycleStartDayChanged = org.settings?.payrollCycleStartDay !== finalPayrollCycleStartDay;

    org.settings = {
      monthlyLeaveLimit: finalLeaveLimit,
      monthlyWFHLimit: finalWFHLimit,
      monthlyPermissionHours: finalPermissionHours,
      allowedIPs: officeWiFiIPs || org.settings?.allowedIPs || ['127.0.0.1', '::1'],
      payrollCycleStartDay: finalPayrollCycleStartDay,
    };
    await org.save();

    if (cycleStartDayChanged) {
      Employee.find({ organizationId: orgId, isActive: true })
        .then(async (employees) => {
          for (const emp of employees) {
            const user = await User.findOne({ employeeId: emp._id });
            if (user) {
              notificationService.dispatchNotification({
                organizationId: org._id,
                recipientId: user._id.toString(),
                title: 'Payroll & Attendance Cycle Updated',
                message: `The company payroll cycle start day has been changed to the ${finalPayrollCycleStartDay}th of every month.`,
                channels: ['IN_APP', 'EMAIL'],
                type: 'PAYROLL'
              }).catch(err => console.error('Failed to dispatch settings change notification:', err));
            }
          }
        })
        .catch((err) => console.error('Failed to find employees for settings change notification:', err));
    }

    // Dynamically update/create corresponding active LeavePolicy documents
    // 1. Casual Leave Limit
    await LeavePolicy.findOneAndUpdate(
      { organizationId: org._id, leaveType: 'Casual Leave' },
      { $set: { monthlyAllowance: finalLeaveLimit, isActive: true } },
      { upsert: true }
    );

    // 2. WFH Limit
    await LeavePolicy.findOneAndUpdate(
      { organizationId: org._id, leaveType: 'WFH' },
      { $set: { monthlyAllowance: finalWFHLimit, isActive: true } },
      { upsert: true }
    );

    // 3. Permission Limit
    await LeavePolicy.findOneAndUpdate(
      { organizationId: org._id, leaveType: 'Permission' },
      { $set: { monthlyAllowance: finalPermissionHours, permissionConversionHours: finalPermissionHours, isActive: true } },
      { upsert: true }
    );

    res.status(200).json({ message: 'Settings updated successfully', settings: req.body });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
