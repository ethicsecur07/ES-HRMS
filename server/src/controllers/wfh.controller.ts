import { Request, Response } from 'express';
import { Leave } from '../models/Leave.js';
import { Employee } from '../models/Employee.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

export const applyWFH = async (req: AuthRequest, res: Response): Promise<void> => {
  const { employeeId, date, reason, expectedTasks } = req.body;

  try {
    const wfh = await Leave.create({
      employeeId,
      leaveType: 'WFH',
      startDate: date,
      endDate: date,
      totalDays: 1,
      reason,
      expectedTasks,
    });

    await createAuditLog(
      'WFH_APPLY',
      req.user?.email || 'Employee',
      'WFH',
      wfh.id,
      `Requested WFH for ${date}`
    );

    res.status(201).json({ wfhRequest: wfh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWFHRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const wfhRequests = await Leave.find({ leaveType: 'WFH' }).populate('employeeId').sort({ createdAt: -1 });
    res.status(200).json({ wfhRequests });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateWFHStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  try {
    const wfh = await Leave.findByIdAndUpdate(
      id,
      { status, rejectionReason, approvedBy: req.user?.id },
      { new: true }
    ).populate('employeeId');

    if (!wfh) {
      res.status(404).json({ message: 'WFH request not found' });
      return;
    }

    if (status === 'APPROVED') {
      await Employee.findByIdAndUpdate(wfh.employeeId, { $inc: { wfhBalance: -1 } });
    }

    await createAuditLog(
      'WFH_STATUS_UPDATE',
      req.user?.email || 'HR/Admin',
      'WFH',
      wfh.id,
      `Updated WFH status to ${status}`
    );

    res.status(200).json({ wfhRequest: wfh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
