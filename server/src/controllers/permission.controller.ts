import { Request, Response } from 'express';
import { Permission } from '../models/Permission.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';

export const applyPermission = async (req: AuthRequest, res: Response): Promise<void> => {
  let employeeId = req.body.employeeId;
  const { date, startTime, endTime, totalHours, reason } = req.body;

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

    const perm = await Permission.create({
      employeeId,
      date,
      startTime,
      endTime,
      totalHours,
      reason,
    });

    await createAuditLog(
      'PERMISSION_APPLY',
      req.user?.email || 'Employee',
      'PERMISSION',
      perm.id,
      `Requested ${totalHours} hrs permission on ${date}`
    );

    const io = getIO();
    if (io) {
      const notifData = {
        _id: `perm-pending-${perm.id}`,
        title: 'New Permission Request',
        message: `Employee requested ${totalHours} hrs permission on ${date}.`,
        type: 'PERMISSION',
        recipientId: 'admin-hr',
      };
      io.to('ADMIN').emit('receive_notification', notifData);
      io.to('HR').emit('receive_notification', notifData);
    }

    res.status(201).json({ permissionRequest: perm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    let query: any = {};

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
        res.status(200).json({ permissions: [], permissionRequests: [] });
        return;
      }
    }

    const permissions = await Permission.find(query).populate('employeeId').sort({ createdAt: -1 });
    res.status(200).json({ permissions, permissionRequests: permissions });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePermissionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const perm = await Permission.findByIdAndUpdate(
      id,
      { approvalStatus: status, approvedBy: req.user?.id },
      { new: true }
    ).populate('employeeId');

    if (!perm) {
      res.status(404).json({ message: 'Permission request not found' });
      return;
    }

    if (status === 'APPROVED') {
      await Employee.findByIdAndUpdate(perm.employeeId, { $inc: { permissionHoursBalance: -perm.totalHours } });
    }

    await createAuditLog(
      'PERMISSION_STATUS_UPDATE',
      req.user?.email || 'HR/Admin',
      'PERMISSION',
      perm.id,
      `Updated permission status to ${status}`
    );

    const io = getIO();
    if (io) {
      const empId = (perm.employeeId as any)._id || perm.employeeId;
      const empUser = await User.findOne({ employeeId: empId });
      const notifData = {
        _id: `perm-status-${perm.id}-${status}`,
        title: `Permission Request ${status}`,
        message: `Your permission request for ${perm.date} (${perm.totalHours} hrs) has been ${status.toLowerCase()}.`,
        type: 'PERMISSION',
        recipientId: empUser ? empUser.id : 'employee',
      };
      if (empUser) {
        io.to(empUser.id).emit('receive_notification', notifData);
      }
    }

    res.status(200).json({ permissionRequest: perm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
