import { Request, Response } from 'express';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { Leave } from '../models/Leave.js';
import { Payroll } from '../models/Payroll.js';
import { AuditLog } from '../models/AuditLog.js';
import { TaskReport } from '../models/TaskReport.js';
import { DEPARTMENTS } from '../constants/index.js';

const countTasks = (text?: string): number => {
  if (!text || text.trim() === '' || text.trim().toLowerCase() === 'none' || text.trim().toLowerCase() === 'n/a' || text.trim() === '-') return 0;
  return text.split(/[\n,;]+/).filter(item => item.trim().length > 0).length;
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalEmployees = await Employee.countDocuments({ isActive: true });
    const presentToday = await Attendance.countDocuments({ date: today, status: 'OFFICE' });
    const wfhToday = await Attendance.countDocuments({ date: today, status: 'WFH' });
    const absentToday = totalEmployees - (presentToday + wfhToday);

    const pendingLeaves = await Leave.countDocuments({ status: 'PENDING' });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const payrollResult = await Payroll.aggregate([
      { $match: { month: currentMonth } },
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

    const recentAttendance = await Attendance.find({ date: { $in: last6DaysStr.map(d => d.dateStr) } });
    
    for (const { dateStr, dayName } of last6DaysStr) {
      const present = recentAttendance.filter(a => a.date === dateStr && a.status === 'OFFICE').length;
      const wfh = recentAttendance.filter(a => a.date === dateStr && a.status === 'WFH').length;
      attendanceTrends.push({ date: dayName, present, wfh });
    }

    // Calculate Department Productivity & Overall Productivity using ONLY DB Data
    const activeEmployees = await Employee.find({ isActive: true });
    const allTaskReports = await TaskReport.find();

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

    res.status(200).json({
      totalEmployees,
      presentToday,
      wfhToday,
      absentToday,
      pendingApprovals: pendingLeaves,
      monthlyPayrollCost,
      attendanceTrends,
      departmentBreakdown,
      overallProductivity,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const auditLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(100);
    res.status(200).json({ auditLogs });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  const settingsData = {
    companyName: 'EthicSecur SofTec',
    adminEmail: 'Official@ethicsecur.com',
    monthlyLeaveLimit: 2,
    monthlyWFHLimit: 1,
    monthlyPermissionHours: 3,
    officeWiFiIPs: ['192.168.29.50', '192.168.29.55', '127.0.0.1', '::1'],
  };
  res.status(200).json({
    ...settingsData,
    settings: settingsData,
  });
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ message: 'Settings updated successfully', settings: req.body });
};
