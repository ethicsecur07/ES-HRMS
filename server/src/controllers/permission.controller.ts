import { Request, Response } from 'express';
import { Permission } from '../models/Permission.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';

export const applyPermission = async (req: AuthRequest, res: Response): Promise<void> => {
  const { employeeId, date, startTime, endTime, totalHours, reason } = req.body;

  try {
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
    const permissions = await Permission.find().populate('employeeId').sort({ createdAt: -1 });
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
      const empUser = await User.findOne({ employeeId: perm.employeeId });
      const notifData = {
        title: `Permission Request ${status}`,
        message: `Your permission request for ${perm.date} (${perm.totalHours} hrs) has been ${status.toLowerCase()}.`,
        type: 'PERMISSION',
        recipientId: empUser ? empUser.id : 'employee',
      };
      if (empUser) {
        io.to(empUser.id).emit('receive_notification', notifData);
      }
      io.to('EMPLOYEE').emit('receive_notification', notifData);
    }

    res.status(200).json({ permissionRequest: perm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
