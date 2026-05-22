import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Attendance } from '../models/Attendance.js';
import { Payroll } from '../models/Payroll.js';
import { TaskReport } from '../models/TaskReport.js';
import { Expense } from '../models/Expense.js';
import { Leave } from '../models/Leave.js';
import { Project } from '../models/Project.js';
import { AuthRequest } from '../types/index.js';

export const getAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    const report = await Attendance.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPayrollReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    const report = await Payroll.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPerformanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    // Aggregate by employee
    const report = await TaskReport.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExpenseReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    const report = await Expense.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLeaveReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    const report = await Leave.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProjectReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) { res.status(400).json({ message: 'Missing org context' }); return; }

    const report = await Project.aggregate([
      { $match: { organizationId: new mongoose.Types.ObjectId(orgId) } },
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
