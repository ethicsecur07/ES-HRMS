import { Request, Response } from 'express';
import { Leave } from '../models/Leave.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';

export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let employeeId = req.body.employeeId;
    if (req.user) {
      const user = await User.findById(req.user.id);
      if (user && user.role === 'EMPLOYEE') {
        if (user.employeeId) {
          employeeId = user.employeeId;
        } else {
          const employee = await Employee.findOne({ email: user.email });
          if (employee) {
            employeeId = employee._id;
          }
        }
      }
    }

    if (!employeeId) {
      res.status(400).json({ message: 'Employee profile not found for this user.' });
      return;
    }

    const leave = await Leave.create({
      ...req.body,
      employeeId,
    });

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
        _id: `leave-pending-${leave.id}`,
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
    const authReq = req as AuthRequest;
    let query: any = { leaveType: { $ne: 'WFH' } };

    if (authReq.user && authReq.user.role === 'EMPLOYEE') {
      const user = await User.findById(authReq.user.id);
      let employeeId = user?.employeeId;
      if (user && !employeeId) {
        const employee = await Employee.findOne({ email: user.email });
        if (employee) {
          employeeId = employee._id;
        }
      }
      if (employeeId) {
        query.employeeId = employeeId;
      } else {
        res.status(200).json({ leaveRequests: [] });
        return;
      }
    }

    const leaveRequests = await Leave.find(query).populate('employeeId').sort({ createdAt: -1 });
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
      const empId = (leave.employeeId as any)._id || leave.employeeId;
      const empUser = await User.findOne({ employeeId: empId });
      const notifData = {
        _id: `leave-status-${leave.id}-${status}`,
        title: `Leave Request ${status}`,
        message: `Your leave request for ${leave.leaveType} (${leave.totalDays} days) has been ${status.toLowerCase()}.`,
        type: 'LEAVE',
        recipientId: empUser ? empUser.id : 'employee',
      };
      if (empUser) {
        io.to(empUser.id).emit('receive_notification', notifData);
      }
    }

    res.status(200).json({ leaveRequest: leave });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
