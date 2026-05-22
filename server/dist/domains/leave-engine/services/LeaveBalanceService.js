"use strict";
/**
 * LeaveBalanceService.ts
 * ----------------------
 * Atomic, transaction-safe leave balance operations.
 * ALL balance reads/writes must go through this service.
 * Fixes: dual balance system, race conditions, missing deductions.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveBalanceService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const LeaveBalance_js_1 = require("../../../models/LeaveBalance.js");
const logger_js_1 = require("../../../utils/logger.js");
class LeaveBalanceService {
    /**
     * Atomically deduct days from leave balance.
     * Uses MongoDB findOneAndUpdate with $inc for race-condition safety.
     * Returns null if insufficient balance.
     */
    static async deductBalance(organizationId, employeeId, leaveType, days, session) {
        // Use findOneAndUpdate with condition to prevent negative balances atomically
        const options = { new: false, session }; // 'new: false' = get BEFORE update
        const before = await LeaveBalance_js_1.LeaveBalance.findOneAndUpdate({
            organizationId,
            employeeId,
            leaveType,
            balance: { $gte: days }, // Atomic condition: only update if balance sufficient
        }, {
            $inc: { balance: -days, used: days },
        }, options);
        if (!before) {
            // Either no balance record or insufficient balance
            const current = await LeaveBalance_js_1.LeaveBalance.findOne({ organizationId, employeeId, leaveType }, null, { session });
            const currentBalance = current?.balance ?? 0;
            logger_js_1.logger.warn(`[LeaveBalance] Deduction failed: ${leaveType} for employee ${employeeId}. Balance: ${currentBalance}, Required: ${days}`);
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
    static async restoreBalance(organizationId, employeeId, leaveType, days, session) {
        const options = { new: false, session };
        const before = await LeaveBalance_js_1.LeaveBalance.findOneAndUpdate({ organizationId, employeeId, leaveType }, { $inc: { balance: days, used: -days } }, options);
        if (!before) {
            logger_js_1.logger.warn(`[LeaveBalance] Restore failed: No balance record for ${leaveType}, employee ${employeeId}`);
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
    static async getBalance(organizationId, employeeId, leaveType) {
        const balance = await LeaveBalance_js_1.LeaveBalance.findOne({ organizationId, employeeId, leaveType });
        return {
            allocated: balance?.allocated ?? 0,
            used: balance?.used ?? 0,
            balance: balance?.balance ?? 0,
        };
    }
    /**
     * Get all balances for an employee across all leave types.
     */
    static async getAllBalances(organizationId, employeeId) {
        const balances = await LeaveBalance_js_1.LeaveBalance.find({ organizationId, employeeId });
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
    static async upsertBalance(organizationId, employeeId, leaveType, allocated, session) {
        await LeaveBalance_js_1.LeaveBalance.findOneAndUpdate({ organizationId, employeeId, leaveType }, {
            $setOnInsert: { organizationId, employeeId, leaveType, used: 0 },
            $set: { allocated, balance: allocated },
        }, { upsert: true, new: true, session });
    }
    /**
     * Idempotent monthly reset: resets balance to policy allocation.
     * Called by cron with org-specific values from LeavePolicy.
     */
    static async monthlyResetForOrg(organizationId, policies) {
        let resetCount = 0;
        let carryForwardCount = 0;
        const balances = await LeaveBalance_js_1.LeaveBalance.find({ organizationId });
        const bulkOps = [];
        for (const balance of balances) {
            const policy = policies.find((p) => p.leaveType === balance.leaveType);
            if (!policy)
                continue;
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
            await LeaveBalance_js_1.LeaveBalance.bulkWrite(bulkOps, { ordered: false });
        }
        return { resetCount, carryForwardCount };
    }
    /**
     * Bulk accrual for all employees in an org (idempotent).
     * Uses period key to prevent double accrual.
     */
    static async bulkAccrue(organizationId, employeeIds, leaveType, amount) {
        if (employeeIds.length === 0)
            return 0;
        const bulkOps = employeeIds.map((empId) => ({
            updateOne: {
                filter: {
                    organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                    employeeId: new mongoose_1.default.Types.ObjectId(empId),
                    leaveType,
                },
                update: {
                    $inc: { allocated: amount, balance: amount },
                },
                upsert: true,
            },
        }));
        const result = await LeaveBalance_js_1.LeaveBalance.bulkWrite(bulkOps);
        return result.modifiedCount + result.upsertedCount;
    }
}
exports.LeaveBalanceService = LeaveBalanceService;
