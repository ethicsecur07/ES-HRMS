import { Request, Response } from 'express';
import { TaskReport } from '../models/TaskReport.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const submitTaskReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskReport = await TaskReport.create({
      ...req.body,
      organizationId: req.user?.organizationId,
    });

    await createAuditLog(
      'TASK_REPORT_SUBMIT',
      req.user?.email || 'Employee',
      'TASK',
      taskReport.id,
      `Submitted daily task report for ${taskReport.date}`,
      req.user?.organizationId
    );

    res.status(201).json({ taskReport });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaskReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const query: any = { organizationId: authReq.user?.organizationId };

    if (authReq.user && authReq.user.role === 'EMPLOYEE') {
      const user = await User.findOne({ _id: authReq.user.id, organizationId: authReq.user.organizationId });
      let employeeId = user?.employeeId;
      if (user && !employeeId) {
        const employee = await Employee.findOne({ email: user.email, organizationId: authReq.user.organizationId });
        if (employee) {
          employeeId = employee._id;
        }
      }
      if (employeeId) {
        query.employeeId = employeeId;
      } else {
        res.status(200).json({ taskReports: [] });
        return;
      }
    }

    const taskReports = await TaskReport.find(query).populate('employeeId').sort({ date: -1 });
    res.status(200).json({ taskReports });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const taskReports = await TaskReport.find({
      employeeId: req.params.employeeId,
      organizationId: authReq.user?.organizationId,
    }).sort({ date: -1 });
    res.status(200).json({ taskReports });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
