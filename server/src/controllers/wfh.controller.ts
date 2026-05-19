import { Request, Response } from 'express';
import { Leave } from '../models/Leave.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';

export const applyWFH = async (req: AuthRequest, res: Response): Promise<void> => {
  let employeeId = req.body.employeeId;
  const { date, reason, expectedTasks } = req.body;

  try {
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

    const io = getIO();
    if (io) {
      const notifData = {
        _id: `wfh-pending-${wfh.id}`,
        title: 'New WFH Request',
        message: `Employee requested WFH for ${date}.`,
        type: 'WFH',
        recipientId: 'admin-hr',
      };
      io.to('ADMIN').emit('receive_notification', notifData);
      io.to('HR').emit('receive_notification', notifData);
    }

    res.status(201).json({ wfhRequest: wfh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWFHRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    let query: any = { leaveType: 'WFH' };

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
        res.status(200).json({ wfhRequests: [] });
        return;
      }
    }

    const wfhRequests = await Leave.find(query).populate('employeeId').sort({ createdAt: -1 });
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

    const io = getIO();
    if (io) {
      const empId = (wfh.employeeId as any)._id || wfh.employeeId;
      const empUser = await User.findOne({ employeeId: empId });
      const notifData = {
        _id: `wfh-status-${wfh.id}-${status}`,
        title: `WFH Request ${status}`,
        message: `Your WFH request for ${wfh.startDate} has been ${status.toLowerCase()}.`,
        type: 'WFH',
        recipientId: empUser ? empUser.id : 'employee',
      };
      if (empUser) {
        io.to(empUser.id).emit('receive_notification', notifData);
      }
    }

    res.status(200).json({ wfhRequest: wfh });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
