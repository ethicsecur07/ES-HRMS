/**
 * LeaveAccrualService.ts
 * ----------------------
 * Idempotent, bulk leave accrual engine.
 * Fixes: duplicate accrual, N+1 queries, missing org scope.
 * Uses period keys to prevent double-accrual for the same period.
 */

import { LeavePolicy } from '../../../models/LeavePolicy.js';
import { LeaveBalance } from '../../../models/LeaveBalance.js';
import { Employee } from '../../../models/Employee.js';
import { Organization } from '../../../models/Organization.js';
import { AuditLog } from '../../../models/AuditLog.js';
import { logger } from '../../../utils/logger.js';

export interface AccrualResult {
  organizationId: string;
  period: string; // YYYY-MM
  employeesProcessed: number;
  balancesUpdated: number;
  skippedDuplicates: number;
  errors: string[];
}

export class LeaveAccrualService {
  /**
   * Run monthly accrual for a single organization.
   * Idempotent: checks if accrual already ran for this period via audit log.
   */
  static async runMonthlyAccrual(organizationId: string, period?: string): Promise<AccrualResult> {
    const currentPeriod = period ?? new Date().toISOString().slice(0, 7); // YYYY-MM

    const result: AccrualResult = {
      organizationId,
      period: currentPeriod,
      employeesProcessed: 0,
      balancesUpdated: 0,
      skippedDuplicates: 0,
      errors: [],
    };

    // Idempotency check: was accrual already run for this org+period?
    const existingAccrual = await AuditLog.findOne({
      organizationId,
      action: 'LEAVE_ACCRUAL_RUN',
      details: { $regex: currentPeriod },
    });

    if (existingAccrual) {
      result.skippedDuplicates = 1;
      logger.warn(`[AccrualService] Accrual already ran for org ${organizationId} period ${currentPeriod}. Skipping.`);
      return result;
    }

    // Load active policies
    const policies = await LeavePolicy.find({ organizationId, isActive: true });
    if (policies.length === 0) {
      logger.warn(`[AccrualService] No active policies for org ${organizationId}`);
      return result;
    }

    // Load all active employees (only IDs for memory efficiency)
    const employees = await Employee.find(
      { organizationId, isActive: true },
      { _id: 1 }
    );
    const employeeIds = employees.map((e) => e._id.toString());
    result.employeesProcessed = employeeIds.length;

    if (employeeIds.length === 0) {
      logger.warn(`[AccrualService] No active employees for org ${organizationId}`);
      return result;
    }

    // Bulk upsert accruals for each policy
    for (const policy of policies) {
      const accrualAmount = Number(policy.monthlyAllowance.toFixed(2));

      const bulkOps = employeeIds.map((empId) => ({
        updateOne: {
          filter: { organizationId, employeeId: empId, leaveType: policy.leaveType },
          update: {
            $inc: { allocated: accrualAmount, balance: accrualAmount },
            $setOnInsert: { organizationId, employeeId: empId, leaveType: policy.leaveType, used: 0 },
          },
          upsert: true,
        },
      }));

      const bulkResult = await (LeaveBalance as any).bulkWrite(bulkOps);
      result.balancesUpdated += bulkResult.modifiedCount + bulkResult.upsertedCount;
    }

    // Record accrual run in audit log (idempotency marker)
    await AuditLog.create({
      organizationId,
      action: 'LEAVE_ACCRUAL_RUN',
      performedBy: 'SYSTEM_CRON',
      module: 'LEAVE',
      affectedRecord: `${employeeIds.length} employees`,
      details: `Monthly accrual for period ${currentPeriod}. Policies: ${policies.map(p => p.leaveType).join(', ')}`,
      timestamp: new Date(),
    });

    logger.info(`[AccrualService] Accrual complete: org=${organizationId}, period=${currentPeriod}, employees=${employeeIds.length}, updates=${result.balancesUpdated}`);
    return result;
  }

  /**
   * Run accrual for ALL organizations (called by global cron).
   */
  static async runGlobalMonthlyAccrual(): Promise<AccrualResult[]> {
    const orgs = await Organization.find({ isActive: true }, { _id: 1 });
    const results: AccrualResult[] = [];

    for (const org of orgs) {
      try {
        const result = await this.runMonthlyAccrual(org._id.toString());
        results.push(result);
      } catch (error: any) {
        logger.error(`[AccrualService] Failed for org ${org._id}`, { error: error.message });
        results.push({
          organizationId: org._id.toString(),
          period: new Date().toISOString().slice(0, 7),
          employeesProcessed: 0,
          balancesUpdated: 0,
          skippedDuplicates: 0,
          errors: [error.message],
        });
      }
    }

    return results;
  }

  /**
   * Org-scoped monthly reset with carry-forward.
   * Replaces the global Employee.updateMany in cronJobs.ts.
   */
  static async runMonthlyReset(organizationId: string): Promise<{ resetCount: number }> {
    const policies = await LeavePolicy.find({ organizationId, isActive: true });

    const bulkOps: any[] = [];
    let resetCount = 0;

    // For each employee's balance, apply carry-forward then reset
    const balances = await LeaveBalance.find({ organizationId });

    for (const balance of balances) {
      const policy = policies.find((p) => p.leaveType === balance.leaveType);
      if (!policy) continue;

      let carryForwardAmount = 0;
      if (policy.carryForward && balance.balance > 0) {
        const limit = policy.carryForwardLimit ?? 0;
        carryForwardAmount = limit > 0 ? Math.min(balance.balance, limit) : balance.balance;
      }

      const newAllocated = policy.monthlyAllowance;
      const newBalance = newAllocated + carryForwardAmount;

      bulkOps.push({
        updateOne: {
          filter: { _id: balance._id },
          update: {
            $set: { allocated: newAllocated, balance: newBalance, used: 0 },
          },
        },
      });
      resetCount++;
    }

    if (bulkOps.length > 0) {
      await LeaveBalance.bulkWrite(bulkOps, { ordered: false });
    }

    // Log the reset
    await AuditLog.create({
      organizationId,
      action: 'LEAVE_BALANCE_RESET',
      performedBy: 'SYSTEM_CRON',
      module: 'LEAVE',
      affectedRecord: `${resetCount} balance records`,
      details: `Monthly balance reset with carry-forward applied`,
      timestamp: new Date(),
    });

    return { resetCount };
  }

  /**
   * Apply carry-forward at year-end.
   * Caps carry-forward to policy limits and logs expiry.
   */
  static async applyYearEndCarryForward(organizationId: string): Promise<{ processedCount: number }> {
    const policies = await LeavePolicy.find({ organizationId, isActive: true });
    const balances = await LeaveBalance.find({ organizationId });

    const bulkOps: any[] = [];
    let processedCount = 0;

    for (const balance of balances) {
      const policy = policies.find((p) => p.leaveType === balance.leaveType);
      if (!policy || !policy.carryForward) {
        // No carry-forward: reset to zero at year end
        bulkOps.push({
          updateOne: {
            filter: { _id: balance._id },
            update: { $set: { balance: 0, used: 0, allocated: 0 } },
          },
        });
      } else {
        const limit = policy.carryForwardLimit ?? 0;
        const carryForward = limit > 0 ? Math.min(balance.balance, limit) : balance.balance;
        bulkOps.push({
          updateOne: {
            filter: { _id: balance._id },
            update: { $set: { balance: carryForward, used: 0, allocated: carryForward } },
          },
        });
      }
      processedCount++;
    }

    if (bulkOps.length > 0) {
      await LeaveBalance.bulkWrite(bulkOps, { ordered: false });
    }

    return { processedCount };
  }
}
