/**
 * leave.controller.ts (REFACTORED)
 * ----------------------------------
 * Thin controller — delegates ALL business logic to LeaveService.
 * Fixes:
 *   - Balance validation before apply
 *   - Server-side totalDays calculation (not trusted from client)
 *   - Duplicate/overlap detection
 *   - Balance deduction for ALL leave types (not just Casual)
 *   - Audit logs with correct organizationId
 *   - Leave cancellation endpoint
 *   - CANCELLED status support
 *   - Org-scoped socket notifications
 */

import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Leave } from '../models/Leave.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';
import { LeaveService } from '../domains/leave-engine/services/LeaveService.js';
import { logger } from '../utils/logger.js';

/**
 * Resolve employeeId from the authenticated user context.
 * Handles EMPLOYEE self-submission and ADMIN/HR submissions on behalf of employee.
 */
async function resolveEmployeeId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;

  // Admins/HR can submit on behalf of an employee
  if (req.user.role !== 'EMPLOYEE') {
    return req.body.employeeId || null;
  }

  // Employee submitting for self
  const user = await User.findOne({
    _id: req.user.id,
    organizationId: req.user.organizationId,
  });

  if (user?.employeeId) return user.employeeId.toString();

  const employee = await Employee.findOne({
    email: user?.email,
    organizationId: req.user.organizationId,
  });

  return employee?._id.toString() ?? null;
}

/**
 * POST /api/leaves/apply
 * Apply for a leave request.
 */
export const applyLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) {
      res.status(400).json({ message: 'Employee profile not found for this user.' });
      return;
    }

    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Organization context is required.' });
      return;
    }

    const { leaveType, startDate, endDate, reason, expectedTasks } = req.body;

    // Delegate all business logic to service
    const result = await LeaveService.createLeave({
      organizationId: orgId,
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
      expectedTasks,
      appliedByUserId: req.user!.id,
      appliedByEmail: req.user!.email,
    });

    if (!result.success) {
      res.status(400).json({
        message: result.message,
        violations: result.violations,
      });
      return;
    }

    // Socket notification — org-scoped room
    const io = getIO();
    if (io && result.leave) {
      const leave = result.leave;
      const notifData = {
        _id: `leave-pending-${leave.id}`,
        title: 'New Leave Request',
        message: `Employee applied for ${leave.leaveType} (${leave.totalDays} days) from ${leave.startDate} to ${leave.endDate}.`,
        type: 'LEAVE',
        organizationId: orgId,
      };
      // Org-scoped rooms: ADMIN and HR rooms namespaced by orgId
      io.to(`org_${orgId}_role_ADMIN`).emit('receive_notification', notifData);
      io.to(`org_${orgId}_role_HR`).emit('receive_notification', notifData);
    }

    res.status(201).json({ leaveRequest: result.leave, message: result.message });
  } catch (error: any) {
    logger.error('[leave.controller] applyLeave error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while applying for leave.' });
  }
};

/**
 * GET /api/leaves
 * Get leaves for org (ADMIN/HR sees all; EMPLOYEE sees own).
 */
export const getLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Organization context is required.' });
      return;
    }

    // Build base query — always org-scoped, never WFH
    const query: any = {
      leaveType: { $ne: 'WFH' },
      organizationId: orgId,
    };

    // Employee: scope to own records only
    if (authReq.user?.role === 'EMPLOYEE') {
      const user = await User.findOne({ _id: authReq.user.id, organizationId: orgId });
      let empId = user?.employeeId;
      if (user && !empId) {
        const emp = await Employee.findOne({ email: user.email, organizationId: orgId });
        empId = emp?._id;
      }
      if (!empId) {
        res.status(200).json({ leaveRequests: [] });
        return;
      }
      query.employeeId = empId;
    }

    // Apply optional filters
    if (req.query.status) query.status = req.query.status;
    if (req.query.leaveType) query.leaveType = req.query.leaveType;

    const leaveRequests = await Leave.find(query)
      .populate('employeeId', 'fullName employeeCode department designation profileImage')
      .sort({ createdAt: -1 })
      .limit(500); // Pagination guard

    res.status(200).json({ leaveRequests });
  } catch (error: any) {
    logger.error('[leave.controller] getLeaves error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while fetching leaves.' });
  }
};

/**
 * PUT /api/leaves/:id/status
 * Approve or reject a leave request.
 * ADMIN/HR only — validated at route level.
 */
export const updateLeaveStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const orgId = req.user?.organizationId;

  if (!orgId) {
    res.status(401).json({ message: 'Organization context is required.' });
    return;
  }

  try {
    let result;

    if (status === 'APPROVED') {
      result = await LeaveService.approveLeave(
        id,
        orgId,
        req.user!.id,
        req.user!.email
      );
    } else if (status === 'REJECTED') {
      if (!rejectionReason) {
        res.status(400).json({ message: 'Rejection reason is required.' });
        return;
      }
      result = await LeaveService.rejectLeave(
        id,
        orgId,
        req.user!.id,
        req.user!.email,
        rejectionReason
      );
    } else {
      res.status(400).json({ message: `Invalid status transition: ${status}` });
      return;
    }

    if (!result.success) {
      res.status(400).json({ message: result.message });
      return;
    }

    // Socket notification to employee
    const io = getIO();
    if (io && result.leave) {
      const leave = result.leave;
      const empId = (leave.employeeId as any)?._id || leave.employeeId;
      const empUser = await User.findOne({ employeeId: empId, organizationId: orgId });
      if (empUser) {
        const notifData = {
          _id: `leave-status-${leave.id}-${status}`,
          title: `Leave Request ${status}`,
          message: `Your ${leave.leaveType} leave (${leave.totalDays} days, ${leave.startDate} – ${leave.endDate}) has been ${status.toLowerCase()}.`,
          type: 'LEAVE',
          organizationId: orgId,
        };
        io.to(`user_${empUser._id}`).emit('receive_notification', notifData);
      }
    }

    res.status(200).json({ leaveRequest: result.leave, message: result.message });
  } catch (error: any) {
    logger.error('[leave.controller] updateLeaveStatus error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while updating leave status.' });
  }
};

/**
 * POST /api/leaves/:id/cancel
 * Cancel an approved or pending leave.
 * Employees can cancel their own; ADMIN/HR can cancel any.
 */
export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const orgId = req.user?.organizationId;

  if (!orgId) {
    res.status(401).json({ message: 'Organization context is required.' });
    return;
  }

  try {
    const isAdminOrHR = req.user?.role === 'ADMIN' || req.user?.role === 'HR';
    let requestedByEmployeeId = req.user!.id;

    if (!isAdminOrHR) {
      // Resolve employee ID for the requesting user
      const empId = await resolveEmployeeId(req);
      if (!empId) {
        res.status(400).json({ message: 'Employee profile not found.' });
        return;
      }
      requestedByEmployeeId = empId;
    }

    const result = await LeaveService.cancelLeave(
      id,
      orgId,
      requestedByEmployeeId,
      req.user!.email,
      isAdminOrHR
    );

    if (!result.success) {
      res.status(400).json({ message: result.message });
      return;
    }

    res.status(200).json({ message: result.message, leaveRequest: result.leave });
  } catch (error: any) {
    logger.error('[leave.controller] cancelLeave error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while cancelling leave.' });
  }
};
