/**
 * permission.controller.ts (REFACTORED)
 * ----------------------------------------
 * Fixes:
 *   - Server-side totalHours calculation (not trusted from client)
 *   - Monthly permission hours limit enforced
 *   - endTime > startTime validation
 *   - Balance deduction via LeaveBalanceService
 *   - Org-scoped notifications
 *   - Correct organizationId in audit logs
 */

import { Request, Response } from 'express';
import { PermissionRequest } from '../models/PermissionRequest.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Leave } from '../models/Leave.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';
import { LeavePolicyEngine } from '../domains/leave-engine/policies/LeavePolicyEngine.js';
import { LeaveBalanceService } from '../domains/leave-engine/services/LeaveBalanceService.js';
import { logger } from '../utils/logger.js';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { LeaveBalance } from '../models/LeaveBalance.js';

async function resolveEmployeeId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;
  if (req.user.role !== 'EMPLOYEE') return req.body.employeeId || null;

  const user = await User.findOne({ _id: req.user.id, organizationId: req.user.organizationId });
  if (user?.employeeId) return user.employeeId.toString();

  const emp = await Employee.findOne({ email: user?.email, organizationId: req.user.organizationId });
  return emp?._id.toString() ?? null;
}

/**
 * POST /api/permissions/apply
 */
export const applyPermission = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Organization context is required.' });
      return;
    }

    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      res.status(400).json({ message: 'Employee profile not found for this user.' });
      return;
    }

    const { date, startTime, endTime, reason } = req.body;

    if (!date || !startTime || !endTime || !reason) {
      res.status(400).json({ message: 'Date, start time, end time, and reason are all required.' });
      return;
    }

    // Validate employee belongs to org
    const employee = await Employee.findOne({ _id: employeeId, organizationId: orgId });
    if (!employee) {
      res.status(403).json({ message: 'Employee not found in this organization.' });
      return;
    }

    // SERVER-SIDE: Calculate hours from times (do NOT trust client-sent totalHours)
    let totalHours: number;
    try {
      totalHours = LeavePolicyEngine.calculatePermissionHours(startTime, endTime);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
      return;
    }

    // Check for approved leaves on this date to prevent permissions during leaves
    const approvedLeave = await Leave.findOne({
      organizationId: orgId,
      employeeId,
      leaveType: { $ne: 'WFH' },
      status: 'APPROVED',
      startDate: { $lte: date },
      endDate: { $gte: date },
    });

    if (approvedLeave) {
      res.status(400).json({
        message: `Permission request blocked: You already have an approved leave (${approvedLeave.leaveType}) from ${approvedLeave.startDate} to ${approvedLeave.endDate}.`,
      });
      return;
    }

    // Check monthly permission limit
    const limitCheck = await LeavePolicyEngine.checkMonthlyPermissionLimit(
      orgId,
      employeeId,
      totalHours
    );

    if (!limitCheck.allowed) {
      res.status(400).json({
        message: `Monthly permission limit exceeded. Limit: ${limitCheck.limitHours} hrs, Used: ${limitCheck.usedHours.toFixed(2)} hrs, Remaining: ${limitCheck.remainingHours.toFixed(2)} hrs, Requested: ${totalHours} hrs.`,
      });
      return;
    }

    // Create permission request
    const perm = await PermissionRequest.create({
      organizationId: orgId,
      employeeId,
      date,
      startTime,
      endTime,
      totalHours, // Server-calculated, not client-provided
      reason,
    });

    await createAuditLog(
      'PERMISSION_APPLY',
      req.user!.email,
      'PERMISSION',
      perm.id,
      `Requested ${totalHours} hrs permission on ${date} (${startTime}–${endTime})`,
      orgId
    );

    const io = getIO();
    if (io) {
      const notifPayload = {
        _id: `perm-pending-${perm.id}`,
        title: 'New Permission Request',
        message: `${employee.fullName} requested ${totalHours} hrs permission on ${date}.`,
        type: 'PERMISSION',
        organizationId: orgId,
      };
      io.to(`org_${orgId}_role_ADMIN`).emit('receive_notification', notifPayload);
      io.to(`org_${orgId}_role_HR`).emit('receive_notification', notifPayload);
    }

    res.status(201).json({
      permissionRequest: perm,
      message: 'Permission request submitted successfully.',
    });
  } catch (error: any) {
    logger.error('[permission.controller] applyPermission error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while submitting permission request.' });
  }
};

/**
 * GET /api/permissions
 */
export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Organization context is required.' });
      return;
    }

    const query: any = { organizationId: orgId };

    if (authReq.user?.role === 'EMPLOYEE') {
      const user = await User.findOne({ _id: authReq.user.id, organizationId: orgId });
      let empId = user?.employeeId;
      if (!empId) {
        const emp = await Employee.findOne({ email: user?.email, organizationId: orgId });
        empId = emp?._id;
      }
      if (!empId) {
        res.status(200).json({ permissions: [], permissionRequests: [] });
        return;
      }
      query.employeeId = empId;
    }

    if (req.query.status) query.approvalStatus = req.query.status;

    const permissions = await PermissionRequest.find(query)
      .populate('employeeId', 'fullName employeeCode department profileImage')
      .sort({ createdAt: -1 })
      .limit(500);

    res.status(200).json({ permissions, permissionRequests: permissions });
  } catch (error: any) {
    logger.error('[permission.controller] getPermissions error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while fetching permissions.' });
  }
};

/**
 * PUT /api/permissions/:id/status
 */
export const updatePermissionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;
  const orgId = req.user?.organizationId;

  if (!orgId) {
    res.status(401).json({ message: 'Organization context is required.' });
    return;
  }

  try {
    const perm = await PermissionRequest.findOne({ _id: id, organizationId: orgId });
    if (!perm) {
      res.status(404).json({ message: 'Permission request not found in this organization.' });
      return;
    }

    if (perm.approvalStatus !== 'PENDING') {
      res.status(400).json({ message: `Cannot update a permission that is already ${perm.approvalStatus}.` });
      return;
    }

    if (status === 'APPROVED') {
      // Atomically deduct permission hours from balance
      const balanceResult = await LeaveBalanceService.deductBalance(
        orgId,
        perm.employeeId.toString(),
        'Permission',
        perm.totalHours
      );

      if (!balanceResult) {
        // Balance record might not exist (legacy setup) — log and proceed
        logger.warn(`[permission.controller] No permission balance record for employee ${perm.employeeId}. Creating one.`);
        await LeaveBalanceService.upsertBalance(orgId, perm.employeeId.toString(), 'Permission', 0);
      }

      // ── Permission → Half-Day Auto-Conversion ──────────────────────────────
      // Check if total approved permission hours this month exceed the policy limit.
      // If permissionAutoConvert is enabled, create a half-day leave automatically.
      try {
        const permPolicy = await LeavePolicy.findOne({
          organizationId: orgId,
          leaveType: 'Permission',
          isActive: true,
        });

        if (permPolicy?.permissionAutoConvert) {
          const limitHours = permPolicy.permissionConversionHours ?? 3;
          const balanceRecord = await LeaveBalance.findOne({
            organizationId: orgId,
            employeeId: perm.employeeId,
            leaveType: 'Permission',
          });
          const totalUsedHours = (balanceRecord?.used ?? 0);

          if (totalUsedHours > limitHours) {
            const excessHours = totalUsedHours - limitHours;
            // 1 half-day per excess (up to a max of 1 auto-conversion per approval)
            const halfDayCount = Math.min(1, Math.floor(excessHours / (limitHours / 2)));

            if (halfDayCount > 0) {
              const today = new Date().toISOString().split('T')[0];
              await Leave.create({
                organizationId: orgId,
                employeeId: perm.employeeId,
                leaveType: 'Casual Leave',
                startDate: perm.date,
                endDate: perm.date,
                totalDays: 0.5,
                isHalfDay: true,
                halfDaySession: 'MORNING',
                reason: `Auto-converted from excess permission hours (${excessHours.toFixed(2)} hrs over ${limitHours} hr monthly limit).`,
                status: 'APPROVED',
                appliedAt: new Date(),
                approvedBy: new (await import('mongoose')).default.Types.ObjectId(req.user!.id),
              });

              // Deduct the half-day from Casual Leave balance
              await LeaveBalanceService.deductBalance(
                orgId,
                perm.employeeId.toString(),
                'Casual Leave',
                0.5
              );

              // Notify the employee
              const io = getIO();
              if (io) {
                const empUser = await User.findOne({ employeeId: perm.employeeId, organizationId: orgId });
                if (empUser) {
                  io.to(`user_${empUser._id}`).emit('receive_notification', {
                    _id: `perm-convert-${perm.id}`,
                    title: 'Permission Converted to Half-Day Leave',
                    message: `Your monthly permission hours exceeded the ${limitHours}-hour limit. A half-day Casual Leave has been automatically deducted for ${perm.date}.`,
                    type: 'LEAVE',
                    organizationId: orgId,
                  });
                }
              }

              await createAuditLog(
                'PERMISSION_AUTO_CONVERTED',
                req.user!.email,
                'PERMISSION',
                perm.id,
                `Permission hours exceeded limit (${totalUsedHours.toFixed(2)} hrs used vs ${limitHours} hr limit). Half-day auto-deducted for ${perm.date}.`,
                orgId
              );

              logger.info(`[permission.controller] Auto-converted permission → half-day for employee ${perm.employeeId} on ${perm.date}`);
            }
          }
        }
      } catch (convErr: any) {
        logger.warn(`[permission.controller] Permission auto-conversion check failed: ${convErr.message}`);
        // Non-fatal — do not block the approval flow
      }
    }

    // Common: save, audit-log, notify, and respond (applies to APPROVED and REJECTED)
    perm.approvalStatus = status;
    perm.approvedBy = new (await import('mongoose')).default.Types.ObjectId(req.user!.id);
    await perm.save();

    await createAuditLog(
      'PERMISSION_STATUS_UPDATE',
      req.user!.email,
      'PERMISSION',
      perm.id,
      `Updated permission status to ${status} for ${perm.date} (${perm.totalHours} hrs)`,
      orgId
    );

    const io = getIO();
    if (io) {
      const empUser = await User.findOne({ employeeId: perm.employeeId, organizationId: orgId });
      if (empUser) {
        io.to(`user_${empUser._id}`).emit('receive_notification', {
          _id: `perm-status-${perm.id}-${status}`,
          title: `Permission Request ${status}`,
          message: `Your permission request for ${perm.date} (${perm.totalHours} hrs) has been ${status.toLowerCase()}.`,
          type: 'PERMISSION',
          organizationId: orgId,
        });
      }
    }

    res.status(200).json({ permissionRequest: perm, message: `Permission ${status.toLowerCase()} successfully.` });
  } catch (error: any) {
    logger.error('[permission.controller] updatePermissionStatus error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while updating permission status.' });
  }
};
