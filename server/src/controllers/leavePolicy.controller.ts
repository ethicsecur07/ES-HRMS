/**
 * leavePolicy.controller.ts
 * --------------------------
 * Admin CRUD for configuring leave policies per leave type per organization.
 */

import { Request, Response } from 'express';
import { LeavePolicy } from '../models/LeavePolicy.js';
import { User } from '../models/User.js';
import { Announcement } from '../models/Announcement.js';
import { AuthRequest } from '../types/index.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { logger } from '../utils/logger.js';
import { LeaveBalanceService } from '../domains/leave-engine/services/LeaveBalanceService.js';

const VALID_LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'WFH',
  'Permission',
  'Compensatory Off',
  'Unpaid Leave',
] as const;

/**
 * GET /api/leave-policies
 * Returns all leave policies for the org (any authenticated user can view).
 */
export const getAllPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const policies = await LeavePolicy.find({ organizationId: orgId }).sort({ leaveType: 1 });
    res.status(200).json({ policies });
  } catch (error: any) {
    logger.error('[leavePolicy] getAllPolicies error', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch leave policies.' });
  }
};

/**
 * POST /api/leave-policies
 * Admin only — create a new leave policy for a leave type.
 */
export const createPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const {
      leaveType,
      monthlyAllowance,
      carryForward,
      carryForwardLimit,
      sandwichLeaveRule,
      holidayOverlapRule,
      compensatoryOffEligibility,
      encashmentRule,
      latePenaltyCount,
      permissionConversionHours,
      halfDayEnabled,
      advanceNoticeDays,
      maxConsecutiveDays,
      applicableGender,
      probationExempt,
      permissionAutoConvert,
      applicableTo,
    } = req.body;

    if (!leaveType || monthlyAllowance === undefined) {
      res.status(400).json({ message: 'leaveType and monthlyAllowance are required.' });
      return;
    }

    if (!VALID_LEAVE_TYPES.includes(leaveType)) {
      res.status(400).json({ message: `Invalid leave type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}` });
      return;
    }

    let allowanceVal = Number(monthlyAllowance);
    let permHoursVal = permissionConversionHours !== undefined ? Number(permissionConversionHours) : 3;
    if (leaveType === 'Permission') {
      if (allowanceVal === 0 || isNaN(allowanceVal)) {
        allowanceVal = permHoursVal;
      } else {
        permHoursVal = allowanceVal;
      }
    }

    const policy = await LeavePolicy.create({
      organizationId: orgId,
      leaveType,
      monthlyAllowance: allowanceVal,
      carryForward: carryForward ?? false,
      carryForwardLimit: carryForwardLimit ?? 0,
      sandwichLeaveRule: sandwichLeaveRule ?? false,
      holidayOverlapRule: holidayOverlapRule ?? true,
      compensatoryOffEligibility: compensatoryOffEligibility ?? { canEarn: false, validityDays: 60 },
      encashmentRule: encashmentRule ?? { canEncash: false, maxEncashableDays: 10, encashmentRatePercentage: 100 },
      latePenaltyCount: latePenaltyCount ?? 3,
      permissionConversionHours: permHoursVal,
      halfDayEnabled: halfDayEnabled ?? true,
      advanceNoticeDays: advanceNoticeDays ?? 0,
      maxConsecutiveDays: maxConsecutiveDays ?? 0,
      applicableGender: applicableGender ?? 'All',
      probationExempt: probationExempt ?? false,
      permissionAutoConvert: permissionAutoConvert ?? false,
      applicableTo: applicableTo ?? 'ALL',
      isActive: true,
    });

    // Sync newly created policy with LeaveBalances for employees immediately
    await LeaveBalanceService.syncBalancesForPolicy(policy);

    await createAuditLog(
      'LEAVE_POLICY_CREATED',
      req.user!.email,
      'LEAVE_POLICY',
      policy.id,
      `Created ${leaveType} policy (${allowanceVal} days/month)`,
      orgId
    );

    try {
      const creator = await User.findById(req.user!.id);
      await Announcement.create({
        organizationId: orgId,
        title: `New Leave Policy: ${leaveType}`,
        content: `A new leave policy has been configured for ${leaveType} with a monthly allowance of ${allowanceVal} days. Applicable to: ${applicableGender || 'All'}.`,
        type: 'POLICY_CHANGE',
        createdBy: req.user!.id,
        createdByName: creator?.name || req.user!.email,
        createdByRole: req.user!.role,
      });
    } catch (annError: any) {
      logger.error('[leavePolicy] announcement creation failed in createPolicy', { error: annError.message });
    }

    res.status(201).json({ policy, message: 'Leave policy created successfully.' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A policy for this leave type already exists. Use the update endpoint.' });
      return;
    }
    logger.error('[leavePolicy] createPolicy error', { error: error.message });
    res.status(500).json({ message: 'Failed to create leave policy.' });
  }
};

/**
 * PUT /api/leave-policies/:id
 * Admin only — update an existing leave policy.
 */
export const updatePolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const policy = await LeavePolicy.findOne({ _id: id, organizationId: orgId });
    if (!policy) {
      res.status(404).json({ message: 'Leave policy not found in your organization.' });
      return;
    }

    // Apply all provided fields
    const updatableFields = [
      'monthlyAllowance', 'carryForward', 'carryForwardLimit',
      'sandwichLeaveRule', 'holidayOverlapRule', 'latePenaltyCount',
      'permissionConversionHours', 'halfDayEnabled', 'advanceNoticeDays',
      'maxConsecutiveDays', 'applicableGender', 'probationExempt',
      'permissionAutoConvert', 'applicableTo', 'isActive',
    ];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        (policy as any)[field] = req.body[field];
      }
    }

    if (policy.leaveType === 'Permission') {
      const reqAllowance = req.body.monthlyAllowance;
      const reqPermHours = req.body.permissionConversionHours;
      if (reqPermHours !== undefined && reqAllowance === undefined) {
        policy.monthlyAllowance = Number(reqPermHours);
      } else if (reqAllowance !== undefined && reqPermHours === undefined) {
        policy.permissionConversionHours = Number(reqAllowance);
      } else if (reqPermHours !== undefined && reqAllowance !== undefined) {
        policy.monthlyAllowance = Number(reqPermHours);
        policy.permissionConversionHours = Number(reqPermHours);
      }
    }

    // Handle nested objects
    if (req.body.compensatoryOffEligibility) {
      policy.compensatoryOffEligibility = {
        ...policy.compensatoryOffEligibility,
        ...req.body.compensatoryOffEligibility,
      };
    }
    if (req.body.encashmentRule) {
      policy.encashmentRule = {
        ...policy.encashmentRule,
        ...req.body.encashmentRule,
      };
    }

    await policy.save();

    // Trigger dynamic synchronization of LeaveBalance records across matching employees
    await LeaveBalanceService.syncBalancesForPolicy(policy);

    await createAuditLog(
      'LEAVE_POLICY_UPDATED',
      req.user!.email,
      'LEAVE_POLICY',
      policy.id,
      `Updated ${policy.leaveType} policy`,
      orgId
    );

    try {
      const creator = await User.findById(req.user!.id);
      await Announcement.create({
        organizationId: orgId,
        title: `Leave Policy Updated: ${policy.leaveType}`,
        content: `The leave policy for ${policy.leaveType} has been updated. The monthly allowance is now set to ${policy.monthlyAllowance} days.`,
        type: 'POLICY_CHANGE',
        createdBy: req.user!.id,
        createdByName: creator?.name || req.user!.email,
        createdByRole: req.user!.role,
      });
    } catch (annError: any) {
      logger.error('[leavePolicy] announcement creation failed in updatePolicy', { error: annError.message });
    }

    res.status(200).json({ policy, message: 'Leave policy updated successfully.' });
  } catch (error: any) {
    logger.error('[leavePolicy] updatePolicy error', { error: error.message });
    res.status(500).json({ message: 'Failed to update leave policy.' });
  }
};

/**
 * PATCH /api/leave-policies/:id/toggle
 * Admin only — toggle active/inactive status for a leave policy.
 */
export const togglePolicyStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const policy = await LeavePolicy.findOne({ _id: id, organizationId: orgId });
    if (!policy) {
      res.status(404).json({ message: 'Leave policy not found in your organization.' });
      return;
    }

    policy.isActive = !policy.isActive;
    await policy.save();

    // Trigger dynamic synchronization of LeaveBalance records across matching employees
    await LeaveBalanceService.syncBalancesForPolicy(policy);

    await createAuditLog(
      'LEAVE_POLICY_TOGGLE',
      req.user!.email,
      'LEAVE_POLICY',
      policy.id,
      `${policy.leaveType} policy set to ${policy.isActive ? 'ACTIVE' : 'INACTIVE'}`,
      orgId
    );

    try {
      const creator = await User.findById(req.user!.id);
      await Announcement.create({
        organizationId: orgId,
        title: `Leave Policy status changed: ${policy.leaveType}`,
        content: `The leave policy for ${policy.leaveType} has been ${policy.isActive ? 'activated' : 'deactivated'} by management.`,
        type: 'POLICY_CHANGE',
        createdBy: req.user!.id,
        createdByName: creator?.name || req.user!.email,
        createdByRole: req.user!.role,
      });
    } catch (annError: any) {
      logger.error('[leavePolicy] announcement creation failed in togglePolicyStatus', { error: annError.message });
    }

    res.status(200).json({
      policy,
      message: `${policy.leaveType} policy is now ${policy.isActive ? 'active' : 'inactive'}.`,
    });
  } catch (error: any) {
    logger.error('[leavePolicy] togglePolicyStatus error', { error: error.message });
    res.status(500).json({ message: 'Failed to toggle policy status.' });
  }
};
