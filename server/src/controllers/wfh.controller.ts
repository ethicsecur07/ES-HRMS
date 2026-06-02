/**
 * wfh.controller.ts (REFACTORED)
 * --------------------------------
 * WFH requests now fully validated:
 *   - Monthly WFH limit enforced server-side
 *   - WFH requests separated from Leave model conceptually
 *   - Overlap detection added
 *   - Balance deduction made atomic
 *   - Org-scoped socket rooms
 */

import { Request, Response } from 'express';
import { Leave } from '../models/Leave.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { Organization } from '../models/Organization.js';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { getIO } from '../sockets/socketHandler.js';
import { AuthRequest } from '../types/index.js';
import { LeaveBalanceService } from '../domains/leave-engine/services/LeaveBalanceService.js';
import { logger } from '../utils/logger.js';

async function resolveEmployeeId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;
  if (req.user.role !== 'EMPLOYEE' && req.user.role !== 'INTERN') return req.body.employeeId || null;

  const user = await User.findOne({ _id: req.user.id, organizationId: req.user.organizationId });
  if (user?.employeeId) return user.employeeId.toString();

  const emp = await Employee.findOne({ email: user?.email, organizationId: req.user.organizationId });
  return emp?._id.toString() ?? null;
}

/**
 * POST /api/wfh/apply
 */
export const applyWFH = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { date, reason, expectedTasks } = req.body;

    if (!date || !reason || !expectedTasks) {
      res.status(400).json({ message: 'Date, reason, and expected tasks are required.' });
      return;
    }

    // Validate employee belongs to org
    const employee = await Employee.findOne({ _id: employeeId, organizationId: orgId });
    if (!employee) {
      res.status(400).json({ message: 'Employee not found in this organization.' });
      return;
    }

    if (employee.isIntern || req.user?.role === 'INTERN') {
      res.status(403).json({ message: 'Interns are not allowed to request WFH.' });
      return;
    }

    // Check WFH monthly limit from policy/org settings
    const policy = await LeavePolicy.findOne({ organizationId: orgId, leaveType: 'WFH', isActive: true });
    const org = await Organization.findById(orgId);
    const monthlyLimit = policy?.monthlyAllowance ?? org?.settings?.monthlyWFHLimit ?? 1;

    // Count approved WFH this month for this employee
    const currentMonth = date.slice(0, 7); // YYYY-MM
    const monthlyWFHCount = await Leave.countDocuments({
      organizationId: orgId,
      employeeId,
      leaveType: 'WFH',
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $gte: `${currentMonth}-01`, $lte: `${currentMonth}-31` },
    });

    if (monthlyWFHCount >= monthlyLimit) {
      res.status(400).json({
        message: `WFH limit exceeded. Monthly limit is ${monthlyLimit} day(s). You have already used ${monthlyWFHCount}.`,
      });
      return;
    }

    // Check for approved leaves on this date to prevent WFH during leaves
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
        message: `WFH request blocked: You already have an approved leave (${approvedLeave.leaveType}) from ${approvedLeave.startDate} to ${approvedLeave.endDate}.`,
      });
      return;
    }

    // Overlap detection
    const overlap = await Leave.findOne({
      organizationId: orgId,
      employeeId,
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $lte: date },
      endDate: { $gte: date },
    });

    if (overlap) {
      res.status(400).json({
        message: `You already have a ${overlap.status.toLowerCase()} ${overlap.leaveType} scheduled on ${date}.`,
      });
      return;
    }

    // Create WFH record
    const wfh = await Leave.create({
      organizationId: orgId,
      employeeId,
      leaveType: 'WFH',
      startDate: date,
      endDate: date,
      totalDays: 1,
      reason,
      expectedTasks,
      status: 'PENDING',
    });

    await createAuditLog(
      'WFH_APPLY',
      req.user!.email,
      'WFH',
      wfh.id,
      `Requested WFH for ${date}`,
      orgId
    );

    const io = getIO();
    if (io) {
      io.to(`org_${orgId}_role_ADMIN`).emit('receive_notification', {
        _id: `wfh-pending-${wfh.id}`,
        title: 'New WFH Request',
        message: `${employee.fullName} requested WFH for ${date}.`,
        type: 'WFH',
        organizationId: orgId,
      });
      io.to(`org_${orgId}_role_HR`).emit('receive_notification', {
        _id: `wfh-pending-${wfh.id}`,
        title: 'New WFH Request',
        message: `${employee.fullName} requested WFH for ${date}.`,
        type: 'WFH',
        organizationId: orgId,
      });
    }

    res.status(201).json({ wfhRequest: wfh, message: 'WFH request submitted successfully.' });
  } catch (error: any) {
    logger.error('[wfh.controller] applyWFH error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while applying for WFH.' });
  }
};

/**
 * GET /api/wfh
 */
export const getWFHRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Organization context is required.' });
      return;
    }

    const query: any = { leaveType: 'WFH', organizationId: orgId };

    if (authReq.user?.role === 'EMPLOYEE') {
      const user = await User.findOne({ _id: authReq.user.id, organizationId: orgId });
      let empId = user?.employeeId;
      if (!empId) {
        const emp = await Employee.findOne({ email: user?.email, organizationId: orgId });
        empId = emp?._id;
      }
      if (!empId) {
        res.status(200).json({ wfhRequests: [] });
        return;
      }
      query.employeeId = empId;
    }

    if (req.query.status) query.status = req.query.status;

    const wfhRequests = await Leave.find(query)
      .populate('employeeId', 'fullName employeeCode department profileImage')
      .sort({ createdAt: -1 })
      .limit(500);

    res.status(200).json({ wfhRequests });
  } catch (error: any) {
    logger.error('[wfh.controller] getWFHRequests error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while fetching WFH requests.' });
  }
};

/**
 * PUT /api/wfh/:id/status
 */
export const updateWFHStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  const orgId = req.user?.organizationId;

  if (!orgId) {
    res.status(401).json({ message: 'Organization context is required.' });
    return;
  }

  try {
    const wfh = await Leave.findOne({ _id: id, organizationId: orgId, leaveType: 'WFH' });
    if (!wfh) {
      res.status(404).json({ message: 'WFH request not found in this organization.' });
      return;
    }

    if (wfh.status !== 'PENDING') {
      res.status(400).json({ message: `Cannot update a WFH request that is already ${wfh.status}.` });
      return;
    }

    if (status === 'APPROVED') {
      // Deduct WFH balance atomically
      const balanceResult = await LeaveBalanceService.deductBalance(
        orgId,
        wfh.employeeId.toString(),
        'WFH',
        1
      );
      // Note: WFH may not have a LeaveBalance entry if using legacy system.
      // Log the attempt but don't fail the approval — balance tracking migrates over time.
      if (!balanceResult) {
        logger.warn(`[wfh.controller] No WFH balance record for employee ${wfh.employeeId}. Proceeding with approval.`);
      }
    }

    wfh.status = status;
    if (status === 'REJECTED' && rejectionReason) {
      wfh.rejectionReason = rejectionReason;
    }
    wfh.approvedBy = new (await import('mongoose')).default.Types.ObjectId(req.user!.id);
    await wfh.save();

    await createAuditLog(
      'WFH_STATUS_UPDATE',
      req.user!.email,
      'WFH',
      wfh.id,
      `Updated WFH status to ${status} for date ${wfh.startDate}`,
      orgId
    );

    const io = getIO();
    if (io) {
      const empUser = await User.findOne({ employeeId: wfh.employeeId, organizationId: orgId });
      if (empUser) {
        io.to(`user_${empUser._id}`).emit('receive_notification', {
          _id: `wfh-status-${wfh.id}-${status}`,
          title: `WFH Request ${status}`,
          message: `Your WFH request for ${wfh.startDate} has been ${status.toLowerCase()}.`,
          type: 'WFH',
          organizationId: orgId,
        });
      }
    }

    res.status(200).json({ wfhRequest: wfh, message: `WFH request ${status.toLowerCase()} successfully.` });
  } catch (error: any) {
    logger.error('[wfh.controller] updateWFHStatus error', { error: error.message });
    res.status(500).json({ message: 'An error occurred while updating WFH status.' });
  }
};
