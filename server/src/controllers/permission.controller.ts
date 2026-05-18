import { Request, Response } from 'express';
import { Permission } from '../models/Permission.js';
import { Employee } from '../models/Employee.js';
import { createAuditLog } from '../services/auditLog.service.js';
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

    res.status(201).json({ permissionRequest: perm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const permissions = await Permission.find().populate('employeeId').sort({ createdAt: -1 });
    res.status(200).json({ permissions });
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

    res.status(200).json({ permissionRequest: perm });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
