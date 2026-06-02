/**
 * leavev2.controller.ts (REFACTORED)
 * ------------------------------------
 * Enterprise leave V2 API.
 * Fixes:
 *   - Accrual now uses LeaveAccrualService (idempotent, bulk, org-scoped)
 *   - Sandwich rule now includes org holidays
 *   - Encashment requires approval workflow + transaction safety
 *   - Summary uses LeaveAnalyticsService for accurate pending counts
 */

import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { LeavePolicy } from '../../models/LeavePolicy.js';
import { LeaveBalance } from '../../models/LeaveBalance.js';
import { Leave } from '../../models/Leave.js';
import { Employee } from '../../models/Employee.js';
import { User } from '../../models/User.js';
import { LeaveAccrualService } from './services/LeaveAccrualService.js';
import { LeaveAnalyticsService } from './services/LeaveAnalyticsService.js';
import { LeavePolicyEngine } from './policies/LeavePolicyEngine.js';
import { LeaveBalanceService } from './services/LeaveBalanceService.js';
import { createAuditLog } from '../../services/auditLog.service.js';
import { logger } from '../../utils/logger.js';
import mongoose from 'mongoose';

/**
 * GET /api/v2/leave/summary
 * Returns policies, balances, and accurate pending counts.
 */
export const getLeaveV2Summary = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const [policies, balances, pendingCounts, balanceDistribution] = await Promise.all([
      LeavePolicy.find({ organizationId: orgId }),
      LeaveBalance.find({ organizationId: orgId }).populate('employeeId', 'fullName employeeCode department'),
      LeaveAnalyticsService.getPendingApprovalCount(orgId),
      LeaveAnalyticsService.getBalanceDistribution(orgId),
    ]);

    res.json({
      policies,
      balances,
      pendingCounts,     // Accurate: includes Leave + WFH + Permission
      balanceDistribution,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v2/leave/accrue
 * Run leave accrual for the organization — idempotent, bulk, org-scoped.
 */
export const runAutomatedAccruals = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const period = req.body.period; // Optional: override period (YYYY-MM)

    const result = await LeaveAccrualService.runMonthlyAccrual(orgId, period);

    if (result.skippedDuplicates > 0) {
      res.json({
        success: false,
        message: `Accrual already ran for period ${result.period}. Skipped to prevent double accrual.`,
        result,
      });
      return;
    }

    await createAuditLog(
      'LEAVE_ACCRUAL_MANUAL',
      req.user!.email,
      'LEAVE',
      `${result.employeesProcessed} employees`,
      `Manual accrual triggered for period ${result.period}`,
      orgId
    );

    res.json({
      success: true,
      message: `Accrual engine processed ${result.employeesProcessed} employees with ${result.balancesUpdated} balance updates.`,
      result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v2/leave/sandwich-check
 * Calculate sandwich leave with actual org holidays.
 */
export const checkSandwichRule = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { startDate, endDate, leaveType } = req.body;

    if (!orgId || !startDate || !endDate || !leaveType) {
      res.status(400).json({ message: 'organizationId, startDate, endDate, and leaveType are required' });
      return;
    }

    // Resolve employeeId from user
    const user = await User.findOne({ _id: req.user?.id, organizationId: orgId });
    let empId = user?.employeeId?.toString();
    if (!empId && user?.email) {
      const emp = await Employee.findOne({ email: user.email, organizationId: orgId });
      empId = emp?._id.toString();
    }

    // Use LeavePolicyEngine which now includes org holidays and intern-aware policy loading
    let durationResult;
    try {
      durationResult = await LeavePolicyEngine.calculateLeaveDuration(orgId, leaveType, startDate, endDate, empId);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
      return;
    }

    res.json({
      sandwichApplies: durationResult.sandwichApplies,
      calendarDays: durationResult.calendarDays,
      businessDays: durationResult.businessDays,
      weekendDays: durationResult.weekendDays,
      holidayDays: durationResult.holidayDays,
      finalDeductionDays: durationResult.finalDeductionDays,
      holidayNames: durationResult.holidayNames,
      message: durationResult.sandwichApplies
        ? `Sandwich rule applies. Weekends (${durationResult.weekendDays}) and holidays (${durationResult.holidayDays}) within leave span will be counted.`
        : `Sandwich rule does not apply. Only business days (${durationResult.businessDays}) are counted.`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v2/leave/encash
 * Submit encashment request — creates a Leave record with status PENDING for approval.
 * Does NOT directly deduct balance (requires HR approval workflow first).
 */
export const submitEncashment = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const empId = req.user?.id;
    const { leaveType, encashDays } = req.body;

    if (!orgId || !leaveType || !encashDays) {
      res.status(400).json({ message: 'leaveType and encashDays are required.' });
      return;
    }

    if (encashDays <= 0) {
      res.status(400).json({ message: 'encashDays must be a positive number.' });
      return;
    }

    // Check policy eligibility
    const policy = await LeavePolicy.findOne({ organizationId: orgId, leaveType, isActive: true });
    if (!policy || !policy.encashmentRule?.canEncash) {
      res.status(400).json({ message: `Leave type '${leaveType}' is not eligible for encashment under current policy.` });
      return;
    }

    // Check max encashable days
    const maxEncashable = policy.encashmentRule.maxEncashableDays ?? 10;
    if (encashDays > maxEncashable) {
      res.status(400).json({ message: `Maximum encashable days is ${maxEncashable}. Requested: ${encashDays}.` });
      return;
    }

    // Verify sufficient balance (read-only check — no deduction yet)
    const balanceCheck = await LeavePolicyEngine.checkBalance(orgId, empId!, leaveType, encashDays);
    if (!balanceCheck.hasEnoughBalance) {
      res.status(400).json({
        message: `Insufficient balance. Available: ${balanceCheck.currentBalance} days, Requested: ${encashDays} days.`,
      });
      return;
    }

    // Create an encashment request record (pending HR approval)
    const encashRequest = await Leave.create({
      organizationId: orgId,
      employeeId: empId,
      leaveType,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      totalDays: encashDays,
      reason: `Encashment request for ${encashDays} days of ${leaveType}`,
      status: 'PENDING',
      isHalfDay: false,
    });

    await createAuditLog(
      'LEAVE_ENCASH_REQUEST',
      req.user!.email,
      'LEAVE',
      encashRequest.id,
      `Encashment request for ${encashDays} days of ${leaveType} (rate: ${policy.encashmentRule.encashmentRatePercentage}%)`,
      orgId
    );

    res.status(201).json({
      success: true,
      message: `Encashment request for ${encashDays} days of ${leaveType} submitted. Pending HR approval.`,
      encashRequest,
      note: 'Balance will be deducted only after HR approval.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v2/leave/analytics
 * Leave analytics for the organization.
 */
export const getLeaveAnalytics = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const [trends, departmentStats, absenteeism, balanceDistribution] = await Promise.all([
      LeaveAnalyticsService.getLeaveTrends(orgId, 6),
      LeaveAnalyticsService.getDepartmentLeaveStats(orgId),
      LeaveAnalyticsService.getAbsenteeismReport(orgId, 10),
      LeaveAnalyticsService.getBalanceDistribution(orgId),
    ]);

    res.json({
      trends,
      departmentStats,
      absenteeism,
      balanceDistribution,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v2/leave/balance/me
 * Employee self-service: fetch own leave balances across all types.
 */
export const getMyLeaveBalances = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!orgId || !userId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    // Resolve employeeId from user
    const user = await User.findOne({ _id: userId, organizationId: orgId });
    let empId = user?.employeeId?.toString();
    if (!empId) {
      const emp = await Employee.findOne({ email: user?.email, organizationId: orgId });
      empId = emp?._id.toString();
    }

    if (!empId) {
      res.json({ data: { balances: [], employeeId: null }, message: 'Employee profile not found.' });
      return;
    }

    const employee = await Employee.findById(empId);
    const isIntern = employee?.isIntern || !!(employee?.designation?.toLowerCase().includes('intern') || employee?.department?.toLowerCase().includes('intern'));

    const [balances, policies] = await Promise.all([
      LeaveBalanceService.ensureBalancesExist(orgId, empId),
      LeavePolicy.find({
        organizationId: orgId,
        isActive: true,
        applicableTo: isIntern ? { $in: ['INTERN', 'ALL'] } : { $in: ['EMPLOYEE', 'ALL'] }
      }),
    ]);

    // Enrich each balance with policy data for the frontend
    const enriched = balances.map((b) => {
      const policy = policies.find((p) => p.leaveType === b.leaveType);
      return {
        leaveType: b.leaveType,
        allocated: b.allocated,
        used: b.used,
        balance: b.balance,
        halfDayEnabled: policy?.halfDayEnabled ?? true,
        carryForward: policy?.carryForward ?? false,
        monthlyAllowance: policy?.monthlyAllowance ?? 0,
        permissionConversionHours: policy?.permissionConversionHours,
      };
    });

    res.json({ balances: enriched, employeeId: empId });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v2/leave/balance/:empId
 * Admin/HR: fetch leave balances for a specific employee.
 */
export const getEmployeeLeaveBalances = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { empId } = req.params;

    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const balances = await LeaveBalanceService.ensureBalancesExist(orgId, empId);
    res.json({ balances, employeeId: empId });
  } catch (err) {
    next(err);
  }
};
