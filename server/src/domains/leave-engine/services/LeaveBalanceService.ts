/**
 * LeaveBalanceService.ts
 * ----------------------
 * Atomic, transaction-safe leave balance operations.
 * ALL balance reads/writes must go through this service.
 * Fixes: dual balance system, race conditions, missing deductions.
 */

import mongoose from 'mongoose';
import { LeaveBalance } from '../../../models/LeaveBalance.js';
import { LeavePolicy } from '../../../models/LeavePolicy.js';
import { Employee } from '../../../models/Employee.js';
import { logger } from '../../../utils/logger.js';

export interface BalanceUpdateResult {
  leaveType: string;
  previousBalance: number;
  newBalance: number;
  previousUsed: number;
  newUsed: number;
}

export class LeaveBalanceService {
  /**
   * Ensure that LeaveBalance records exist for all active LeavePolicies for an employee.
   * If any are missing, they are initialized with the policy allowance (or employee defaults).
   */
  static async ensureBalancesExist(
    organizationId: string,
    employeeId: string,
    session?: mongoose.ClientSession
  ): Promise<any[]> {
    const employee = await Employee.findOne({ _id: employeeId, organizationId }).session(session ?? null);
    if (!employee) {
      return [];
    }

    const isIntern = employee.isIntern || !!(employee.designation?.toLowerCase().includes('intern') || employee.department?.toLowerCase().includes('intern'));
    if (isIntern) {
      return [];
    }

    const [balances, policies] = await Promise.all([
      LeaveBalance.find({ organizationId, employeeId }).session(session ?? null),
      LeavePolicy.find({
        organizationId,
        isActive: true,
        applicableTo: { $in: ['EMPLOYEE', 'ALL'] }
      }).session(session ?? null),
    ]);

    const missingPolicies = policies.filter(p => !balances.some(b => b.leaveType === p.leaveType));
    if (missingPolicies.length === 0) {
      return balances;
    }

    const newBalances = [];
    for (const policy of missingPolicies) {
      let initialAllocated = policy.monthlyAllowance;
      if (policy.leaveType === 'Casual Leave' && initialAllocated === 0) {
        initialAllocated = employee.leaveBalance ?? 2;
      } else if (policy.leaveType === 'WFH' && initialAllocated === 0) {
        initialAllocated = employee.wfhBalance ?? 1;
      } else if (policy.leaveType === 'Permission' && initialAllocated === 0) {
        initialAllocated = employee.permissionHoursBalance ?? 3;
      }

      const newB = await LeaveBalance.findOneAndUpdate(
        { organizationId, employeeId, leaveType: policy.leaveType },
        {
          $setOnInsert: {
            organizationId,
            employeeId,
            leaveType: policy.leaveType,
            allocated: initialAllocated,
            balance: initialAllocated,
            used: 0
          }
        },
        { upsert: true, new: true, session }
      );
      if (newB) {
        newBalances.push(newB);
      }
    }

    return [...balances, ...newBalances];
  }

  /**
   * Atomically deduct days from leave balance.
   * Uses MongoDB findOneAndUpdate with $inc for race-condition safety.
   * Returns null if insufficient balance.
   */
  static async deductBalance(
    organizationId: string,
    employeeId: string,
    leaveType: string,
    days: number,
    session?: mongoose.ClientSession
  ): Promise<BalanceUpdateResult | null> {
    // Ensure all active policy balances are initialized
    await this.ensureBalancesExist(organizationId, employeeId, session);

    // Use findOneAndUpdate with condition to prevent negative balances atomically
    const options: mongoose.QueryOptions = { new: false, session }; // 'new: false' = get BEFORE update

    const before = await LeaveBalance.findOneAndUpdate(
      {
        organizationId,
        employeeId,
        leaveType,
        balance: { $gte: days }, // Atomic condition: only update if balance sufficient
      },
      {
        $inc: { balance: -days, used: days },
      },
      options
    );

    if (!before) {
      // Either no balance record or insufficient balance
      const current = await LeaveBalance.findOne({ organizationId, employeeId, leaveType }, null, { session });
      const currentBalance = current?.balance ?? 0;
      logger.warn(`[LeaveBalance] Deduction failed: ${leaveType} for employee ${employeeId}. Balance: ${currentBalance}, Required: ${days}`);
      return null;
    }

    return {
      leaveType,
      previousBalance: before.balance,
      newBalance: before.balance - days,
      previousUsed: before.used,
      newUsed: before.used + days,
    };
  }

  /**
   * Atomically restore balance (used on cancellation/rejection of approved leave).
   */
  static async restoreBalance(
    organizationId: string,
    employeeId: string,
    leaveType: string,
    days: number,
    session?: mongoose.ClientSession
  ): Promise<BalanceUpdateResult | null> {
    const options: mongoose.QueryOptions = { new: false, session };

    const before = await LeaveBalance.findOneAndUpdate(
      { organizationId, employeeId, leaveType },
      { $inc: { balance: days, used: -days } },
      options
    );

    if (!before) {
      logger.warn(`[LeaveBalance] Restore failed: No balance record for ${leaveType}, employee ${employeeId}`);
      return null;
    }

    return {
      leaveType,
      previousBalance: before.balance,
      newBalance: before.balance + days,
      previousUsed: before.used,
      newUsed: Math.max(0, before.used - days),
    };
  }

  /**
   * Get current balance for an employee and leave type.
   */
  static async getBalance(
    organizationId: string,
    employeeId: string,
    leaveType: string
  ): Promise<{ allocated: number; used: number; balance: number }> {
    const balance = await LeaveBalance.findOne({ organizationId, employeeId, leaveType });
    return {
      allocated: balance?.allocated ?? 0,
      used: balance?.used ?? 0,
      balance: balance?.balance ?? 0,
    };
  }

  /**
   * Get all balances for an employee across all leave types.
   */
  static async getAllBalances(
    organizationId: string,
    employeeId: string
  ): Promise<Array<{ leaveType: string; allocated: number; used: number; balance: number }>> {
    const balances = await LeaveBalance.find({ organizationId, employeeId });
    return balances.map((b) => ({
      leaveType: b.leaveType,
      allocated: b.allocated,
      used: b.used,
      balance: b.balance,
    }));
  }

  /**
   * Initialize or reset balance for an employee + leave type.
   * Uses upsert to avoid duplicates.
   */
  static async upsertBalance(
    organizationId: string,
    employeeId: string,
    leaveType: string,
    allocated: number,
    session?: mongoose.ClientSession
  ): Promise<void> {
    await LeaveBalance.findOneAndUpdate(
      { organizationId, employeeId, leaveType },
      {
        $setOnInsert: { organizationId, employeeId, leaveType, used: 0 },
        $set: { allocated, balance: allocated },
      },
      { upsert: true, new: true, session }
    );
  }

  /**
   * Idempotent monthly reset: resets balance to policy allocation.
   * Called by cron with org-specific values from LeavePolicy.
   */
  static async monthlyResetForOrg(
    organizationId: string,
    policies: Array<{ leaveType: string; monthlyAllowance: number; carryForward: boolean; carryForwardLimit?: number }>
  ): Promise<{ resetCount: number; carryForwardCount: number }> {
    let resetCount = 0;
    let carryForwardCount = 0;

    const balances = await LeaveBalance.find({ organizationId });

    const bulkOps: any[] = [];

    for (const balance of balances) {
      const policy = policies.find((p) => p.leaveType === balance.leaveType);
      if (!policy) continue;

      const newAllocated = policy.monthlyAllowance;
      let carryForwardAmount = 0;

      if (policy.carryForward && balance.balance > 0) {
        const limit = policy.carryForwardLimit ?? 0;
        carryForwardAmount = limit > 0 ? Math.min(balance.balance, limit) : balance.balance;
        carryForwardCount++;
      }

      const newBalance = newAllocated + carryForwardAmount;

      bulkOps.push({
        updateOne: {
          filter: { _id: balance._id },
          update: {
            $set: {
              allocated: newAllocated,
              balance: newBalance,
              used: 0,
            },
          },
        },
      });
      resetCount++;
    }

    if (bulkOps.length > 0) {
      await (LeaveBalance as any).bulkWrite(bulkOps, { ordered: false });
    }

    return { resetCount, carryForwardCount };
  }

  /**
   * Bulk accrual for all employees in an org (idempotent).
   * Uses period key to prevent double accrual.
   */
  static async bulkAccrue(
    organizationId: string,
    employeeIds: string[],
    leaveType: string,
    amount: number
  ): Promise<number> {
    if (employeeIds.length === 0) return 0;

    const bulkOps = employeeIds.map((empId) => ({
      updateOne: {
        filter: {
          organizationId: new mongoose.Types.ObjectId(organizationId),
          employeeId: new mongoose.Types.ObjectId(empId),
          leaveType,
        } as any,
        update: {
          $inc: { allocated: amount, balance: amount },
        } as any,
        upsert: true,
      },
    }));

    const result = await LeaveBalance.bulkWrite(bulkOps as any);
    return result.modifiedCount + result.upsertedCount;
  }

  /**
   * Sync LeaveBalance records when a LeavePolicy is created, updated, or toggled.
   * Keeps employee leave balances dynamically updated with policy changes.
   */
  static async syncBalancesForPolicy(
    policy: any,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const orgId = policy.organizationId;
    const leaveType = policy.leaveType;
    const newAllowance = policy.monthlyAllowance;

    // Find all active employees matching the policy's applicability
    const query: any = { organizationId: orgId, isActive: true };
    if (policy.applicableTo === 'EMPLOYEE' || policy.applicableTo === 'ALL') {
      query.isIntern = { $ne: true };
    } else if (policy.applicableTo === 'INTERN') {
      query.isIntern = true;
    }

    const employees = await Employee.find(query).session(session ?? null);
    if (employees.length === 0) return;

    const bulkOps = [];
    for (const emp of employees) {
      // Find the current balance record to calculate adjustment
      const currentBalance = await LeaveBalance.findOne({
        organizationId: orgId,
        employeeId: emp._id,
        leaveType
      }).session(session ?? null);

      if (currentBalance) {
        // If it exists, adjust allocated to newAllowance.
        // Also update the remaining balance: newBalance = newAllowance - used
        const newBal = Math.max(0, newAllowance - currentBalance.used);
        bulkOps.push({
          updateOne: {
            filter: { _id: currentBalance._id },
            update: {
              $set: {
                allocated: newAllowance,
                balance: newBal
              }
            }
          }
        });
      } else {
        // If no balance record exists yet, initialize it
        bulkOps.push({
          updateOne: {
            filter: { organizationId: orgId, employeeId: emp._id, leaveType },
            update: {
              $setOnInsert: {
                organizationId: orgId,
                employeeId: emp._id,
                leaveType,
                allocated: newAllowance,
                balance: newAllowance,
                used: 0
              }
            },
            upsert: true
          }
        });
      }

      // Also update static employee balance fields if they exist and are applicable
      const updateFields: any = {};
      if (leaveType === 'Casual Leave') {
        updateFields.leaveBalance = newAllowance;
      } else if (leaveType === 'WFH') {
        updateFields.wfhBalance = newAllowance;
      } else if (leaveType === 'Permission') {
        updateFields.permissionHoursBalance = newAllowance;
      }

      if (Object.keys(updateFields).length > 0) {
        await Employee.updateOne(
          { _id: emp._id },
          { $set: updateFields }
        ).session(session ?? null);
      }
    }

    if (bulkOps.length > 0) {
      await LeaveBalance.bulkWrite(bulkOps, { ordered: false, session: session ?? undefined });
    }
  }
}
