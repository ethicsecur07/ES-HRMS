import { Request, Response } from 'express';
import { TaskReport } from '../models/TaskReport.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const submitTaskReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const taskReport = await TaskReport.create(req.body);

    await createAuditLog(
      'TASK_REPORT_SUBMIT',
      req.user?.email || 'Employee',
      'TASK',
      taskReport.id,
      `Submitted daily task report for ${taskReport.date}`
    );

    res.status(201).json({ taskReport });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaskReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskReports = await TaskReport.find().populate('employeeId').sort({ date: -1 });
    res.status(200).json({ taskReports });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskReports = await TaskReport.find({ employeeId: req.params.employeeId }).sort({ date: -1 });
    res.status(200).json({ taskReports });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
