import { Request, Response } from 'express';
import { Leave } from '../models/Leave.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.create(req.body);

    await createAuditLog(
      'LEAVE_APPLY',
      req.user?.email || 'Employee',
      'LEAVE',
      leave.id,
      `Applied for ${leave.leaveType} (${leave.totalDays} days)`
    );

    const io = getIO();
    if (io) {
      const notifData = {
        title: 'New Leave Request',
        message: `Employee applied for ${leave.leaveType} (${leave.totalDays} days).`,
        type: 'LEAVE',
        recipientId: 'admin-hr',
      };
      io.to('ADMIN').emit('receive_notification', notifData);
      io.to('HR').emit('receive_notification', notifData);
    }

    res.status(201).json({ leaveRequest: leave });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const leaveRequests = await Leave.find().populate('employeeId').sort({ createdAt: -1 });
    res.status(200).json({ leaveRequests });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;

  try {
    const leave = await Leave.findByIdAndUpdate(
      id,
      { status, rejectionReason, approvedBy: req.user?.id },
      { new: true }
    ).populate('employeeId');

    if (!leave) {
      res.status(404).json({ message: 'Leave request not found' });
      return;
    }

    if (status === 'APPROVED' && leave.leaveType === 'Casual Leave') {
      await Employee.findByIdAndUpdate(leave.employeeId, { $inc: { leaveBalance: -leave.totalDays } });
    }

    await createAuditLog(
      'LEAVE_STATUS_UPDATE',
      req.user?.email || 'HR/Admin',
      'LEAVE',
      leave.id,
      `Updated leave status to ${status}`
    );

    const io = getIO();
    if (io) {
      const empUser = await User.findOne({ employeeId: leave.employeeId });
      const notifData = {
        title: `Leave Request ${status}`,
        message: `Your leave request for ${leave.leaveType} (${leave.totalDays} days) has been ${status.toLowerCase()}.`,
        type: 'LEAVE',
        recipientId: empUser ? empUser.id : 'employee',
      };
      if (empUser) {
        io.to(empUser.id).emit('receive_notification', notifData);
      }
      io.to('EMPLOYEE').emit('receive_notification', notifData);
    }

    res.status(200).json({ leaveRequest: leave });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
