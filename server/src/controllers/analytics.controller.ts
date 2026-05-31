import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
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
import { User } from '../models/User.js';
import { notificationService } from '../services/notification.service.js';
import { LeaveAnalyticsService } from '../domains/leave-engine/services/LeaveAnalyticsService.js';
import { Announcement } from '../models/Announcement.js';
import { Meeting } from '../models/Meeting.js';
import { WFHRequest } from '../models/WFHRequest.js';
import { PermissionRequest } from '../models/PermissionRequest.js';


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

    // Calculate weekly attendance overview (Mon to Sun) with present, wfh, and leave counts
    const weekDates = [];
    const todayDate = new Date();
    const currentDay = todayDate.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    
    const monday = new Date(todayDate);
    monday.setDate(todayDate.getDate() + diffToMonday);
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      weekDates.push({ dateStr, dayName });
    }

    const recentAttendance = await Attendance.find({
      date: { $in: weekDates.map(w => w.dateStr) },
      organizationId: orgId,
    });

    const approvedLeaves = await Leave.find({
      organizationId: orgId,
      status: 'APPROVED',
      startDate: { $lte: weekDates[6].dateStr },
      endDate: { $gte: weekDates[0].dateStr }
    });

    const attendanceTrends = [];
    for (const { dateStr, dayName } of weekDates) {
      const present = recentAttendance.filter(a => a.date === dateStr && (a.status === 'OFFICE' || a.status === 'PRESENT')).length;
      const wfh = recentAttendance.filter(a => a.date === dateStr && a.status === 'WFH').length;
      
      const leaveEmployeesFromAttendance = recentAttendance
        .filter(a => a.date === dateStr && a.status === 'LEAVE')
        .map(a => a.employeeId.toString());

      const leaveEmployeesFromLeaves = approvedLeaves
        .filter(l => l.startDate <= dateStr && l.endDate >= dateStr)
        .map(l => l.employeeId.toString());

      const uniqueLeaveEmployeeIds = new Set([
        ...leaveEmployeesFromAttendance,
        ...leaveEmployeesFromLeaves
      ]);

      const leave = uniqueLeaveEmployeeIds.size;

      attendanceTrends.push({ date: dayName, dateStr, present, wfh, leave });
    }

    const totalWeeklyActions = attendanceTrends.reduce((sum, d) => sum + d.present + d.wfh + d.leave, 0);
    if (totalWeeklyActions === 0) {
      const mockData = [
        { present: 58, wfh: 30, leave: 12 },
        { present: 58, wfh: 22, leave: 20 },
        { present: 48, wfh: 27, leave: 25 },
        { present: 58, wfh: 32, leave: 10 },
        { present: 72, wfh: 18, leave: 10 },
        { present: 42, wfh: 33, leave: 25 },
        { present: 45, wfh: 38, leave: 17 }
      ];
      attendanceTrends.forEach((item, idx) => {
        item.present = mockData[idx].present;
        item.wfh = mockData[idx].wfh;
        item.leave = mockData[idx].leave;
      });
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
      salaryCycleStartDay: org.settings?.salaryCycleStartDay || 1,
      officeWiFiIPs: org.settings?.allowedIPs || ['127.0.0.1', '::1'],
      adminEmail: org.settings?.adminEmail || '',
      activeWorkdays: org.settings?.activeWorkdays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      loginApprovalRoles: org.settings?.loginApprovalRoles || ['ADMIN'],
      visibleDepartments: org.settings?.visibleDepartments || ['Development', 'Digital Marketing', 'HR', 'BA', 'BDA'],
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
    const org = await Organization.findById(authReq.user?.organizationId);
    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }

    const oldSalaryCycleStartDay = org.settings?.salaryCycleStartDay || 1;
    const oldLeaveLimit = org.settings?.monthlyLeaveLimit || 2;
    const oldPermissionHours = org.settings?.monthlyPermissionHours || 3;

    const { companyName, monthlyLeaveLimit, monthlyWFHLimit, monthlyPermissionHours, salaryCycleStartDay, officeWiFiIPs, adminEmail, activeWorkdays, loginApprovalRoles, visibleDepartments } = req.body;
    
    const newSalaryCycleStartDay = Number(salaryCycleStartDay) || 1;
    const newLeaveLimit = Number(monthlyLeaveLimit) || 2;
    const newPermissionHours = Number(monthlyPermissionHours) || 3;

    const getOrdinal = (n: number) => {
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

    if (companyName) org.name = companyName;

    // Use field-level mutations to preserve other settings (customHolidays, activeWorkdays, theme, etc.)
    if (!org.settings) org.settings = {} as any;
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

    if (visibleDepartments && Array.isArray(visibleDepartments)) {
      org.settings.visibleDepartments = visibleDepartments;
    }

    // Tell Mongoose the nested settings object has changed
    org.markModified('settings');
    await org.save();

    if (changes.length > 0) {
      const activeUsers = await User.find({ organizationId: org._id, isActive: true });
      const notificationTitle = "Company Policy Update Alert";
      const notificationMessage = `The administrator has updated the company policies:\n• ${changes.join('\n• ')}`;
      
      for (const u of activeUsers) {
        await notificationService.dispatchNotification({
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/analytics/announcements-actions
 * Unified endpoint for announcements, today's meetings, tasks, projects, and pending approvals.
 */
export const getAnnouncementsAndActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization context is missing' });
      return;
    }

    const role = authReq.user?.role;
    const userId = authReq.user?.id;
    const userEmail = authReq.user?.email?.toLowerCase();

    // 1. Fetch latest 20 announcements in organization (both types: ANNOUNCEMENT and POLICY_CHANGE)
    const announcements = await Announcement.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(20);

    // 2. Fetch today's meetings (start date matching today, user is organizer or attendee)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const meetingsToday = await Meeting.find({
      organizationId: orgId,
      startDateTime: { $gte: startOfToday, $lte: endOfToday },
      status: { $ne: 'CANCELLED' },
      $or: [
        { organizer: userEmail },
        { 'attendees.email': userEmail },
      ],
    }).sort({ startDateTime: 1 });

    // Find Employee associated with user
    const userObj = await User.findById(userId);
    let empId = userObj?.employeeId;
    if (!empId && userEmail) {
      const emp = await Employee.findOne({ email: userEmail, organizationId: orgId });
      empId = emp?._id;
    }

    // Initialize arrays
    let pendingLeaves: any[] = [];
    let pendingWFH: any[] = [];
    let pendingPermissions: any[] = [];
    let myLeaves: any[] = [];
    let myWFH: any[] = [];
    let myPermissions: any[] = [];
    let myProjects: any[] = [];
    let myTasks: any[] = [];

    // 3. Role-based Actions: HR, MANAGER, and ADMIN get pending approvals queue
    if (role === 'HR' || role === 'ADMIN' || role === 'MANAGER') {
      pendingLeaves = await Leave.find({ organizationId: orgId, status: 'PENDING' })
        .populate('employeeId', 'fullName employeeCode department profileImage')
        .sort({ createdAt: -1 });

      pendingWFH = await WFHRequest.find({ organizationId: orgId, status: 'PENDING' })
        .populate('employeeId', 'fullName employeeCode department profileImage')
        .sort({ createdAt: -1 });

      pendingPermissions = await PermissionRequest.find({ organizationId: orgId, approvalStatus: 'PENDING' })
        .populate('employeeId', 'fullName employeeCode department profileImage')
        .sort({ createdAt: -1 });
    }

    // 4. Employee Applied Requests & Work (Tasks/Projects)
    if (empId) {
      // Applied requests (Leaves, WFH, Permissions)
      myLeaves = await Leave.find({ organizationId: orgId, employeeId: empId })
        .sort({ createdAt: -1 })
        .limit(10);

      myWFH = await WFHRequest.find({ organizationId: orgId, employeeId: empId })
        .sort({ createdAt: -1 })
        .limit(10);

      myPermissions = await PermissionRequest.find({ organizationId: orgId, employeeId: empId })
        .sort({ createdAt: -1 })
        .limit(10);

      // Active Projects containing this employee
      myProjects = await Project.find({
        organizationId: orgId,
        $or: [
          { teamMemberIds: empId },
          { allocatedManagerId: userId },
          { teamLeadId: userId }
        ]
      }).sort({ updatedAt: -1 });

      // Active Tasks assigned to this employee
      myTasks = await Task.find({
        organizationId: orgId,
        assignedTo: empId,
        status: { $ne: 'COMPLETED' },
      })
        .populate('projectId', 'name')
        .sort({ dueDate: 1 });
    }

    res.status(200).json({
      announcements,
      meetingsToday,
      pendingLeaves,
      pendingWFH,
      pendingPermissions,
      myLeaves,
      myWFH,
      myPermissions,
      myProjects,
      myTasks,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
