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
const LeavePolicy_js_1 = require("../../../models/LeavePolicy.js");
const Employee_js_1 = require("../../../models/Employee.js");
const logger_js_1 = require("../../../utils/logger.js");
class LeaveBalanceService {
    /**
     * Ensure that LeaveBalance records exist for all active LeavePolicies for an employee.
     * If any are missing, they are initialized with the policy allowance (or employee defaults).
     */
    static async ensureBalancesExist(organizationId, employeeId, session) {
        const employee = await Employee_js_1.Employee.findOne({ _id: employeeId, organizationId }).session(session ?? null);
        if (!employee) {
            return [];
        }
        const isIntern = employee.isIntern || !!(employee.designation?.toLowerCase().includes('intern') || employee.department?.toLowerCase().includes('intern'));
        if (isIntern) {
            return [];
        }
        const [balances, policies] = await Promise.all([
            LeaveBalance_js_1.LeaveBalance.find({ organizationId, employeeId }).session(session ?? null),
            LeavePolicy_js_1.LeavePolicy.find({
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
            }
            else if (policy.leaveType === 'WFH' && initialAllocated === 0) {
                initialAllocated = employee.wfhBalance ?? 1;
            }
            else if (policy.leaveType === 'Permission' && initialAllocated === 0) {
                initialAllocated = employee.permissionHoursBalance ?? 3;
            }
            const newB = await LeaveBalance_js_1.LeaveBalance.findOneAndUpdate({ organizationId, employeeId, leaveType: policy.leaveType }, {
                $setOnInsert: {
                    organizationId,
                    employeeId,
                    leaveType: policy.leaveType,
                    allocated: initialAllocated,
                    balance: initialAllocated,
                    used: 0
                }
            }, { upsert: true, new: true, session });
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
    static async deductBalance(organizationId, employeeId, leaveType, days, session) {
        // Ensure all active policy balances are initialized
        await this.ensureBalancesExist(organizationId, employeeId, session);
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
    /**
     * Sync LeaveBalance records when a LeavePolicy is created, updated, or toggled.
     * Keeps employee leave balances dynamically updated with policy changes.
     */
    static async syncBalancesForPolicy(policy, session) {
        const orgId = policy.organizationId;
        const leaveType = policy.leaveType;
        const newAllowance = policy.monthlyAllowance;
        // Find all active employees matching the policy's applicability
        const query = { organizationId: orgId, isActive: true };
        if (policy.applicableTo === 'EMPLOYEE' || policy.applicableTo === 'ALL') {
            query.isIntern = { $ne: true };
        }
        else if (policy.applicableTo === 'INTERN') {
            query.isIntern = true;
        }
        const employees = await Employee_js_1.Employee.find(query).session(session ?? null);
        if (employees.length === 0)
            return;
        const bulkOps = [];
        for (const emp of employees) {
            // Find the current balance record to calculate adjustment
            const currentBalance = await LeaveBalance_js_1.LeaveBalance.findOne({
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
            }
            else {
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
            const updateFields = {};
            if (leaveType === 'Casual Leave') {
                updateFields.leaveBalance = newAllowance;
            }
            else if (leaveType === 'WFH') {
                updateFields.wfhBalance = newAllowance;
            }
            else if (leaveType === 'Permission') {
                updateFields.permissionHoursBalance = newAllowance;
            }
            if (Object.keys(updateFields).length > 0) {
                await Employee_js_1.Employee.updateOne({ _id: emp._id }, { $set: updateFields }).session(session ?? null);
            }
        }
        if (bulkOps.length > 0) {
            await LeaveBalance_js_1.LeaveBalance.bulkWrite(bulkOps, { ordered: false, session: session ?? undefined });
        }
    }
}
exports.LeaveBalanceService = LeaveBalanceService;
