"use strict";
/**
 * LatePenaltyService.ts
 * ----------------------
 * Policy-driven late mark tracking and leave deduction.
 *
 * Logic:
 *   1. Count late check-ins for the employee in the current calendar month.
 *   2. Compare to LeavePolicy.latePenaltyCount for the org (default: 3).
 *   3. When count hits exactly the threshold, deduct 0.5 day from Casual Leave balance.
 *   4. Subsequent late marks beyond the threshold also trigger deductions (every N marks).
 *
 * Called from AttendanceService.checkIn AFTER the attendance record is created.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LatePenaltyService = void 0;
const Attendance_js_1 = require("../../../models/Attendance.js");
const LeavePolicy_js_1 = require("../../../models/LeavePolicy.js");
const LeaveBalanceService_js_1 = require("./LeaveBalanceService.js");
const socketHandler_js_1 = require("../../../sockets/socketHandler.js");
const User_js_1 = require("../../../models/User.js");
const logger_js_1 = require("../../../utils/logger.js");
class LatePenaltyService {
    /**
     * Evaluate and apply a late penalty if the threshold is crossed.
     * Should be called AFTER the attendance record for today has been created.
     */
    static async evaluateAndApplyPenalty(organizationId, employeeId, employeeEmail) {
        const orgId = organizationId.toString();
        const empId = employeeId.toString();
        try {
            // 1. Load policy threshold (default: 3 late marks → 0.5 day deduction)
            const policy = await LeavePolicy_js_1.LeavePolicy.findOne({
                organizationId: orgId,
                leaveType: 'Casual Leave',
                isActive: true,
            });
            const threshold = policy?.latePenaltyCount ?? 3;
            // 2. Count late marks this calendar month
            const now = new Date();
            const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                .toISOString()
                .split('T')[0];
            const lateCountThisMonth = await Attendance_js_1.Attendance.countDocuments({
                organizationId: orgId,
                employeeId: empId,
                isLate: true,
                date: { $gte: monthStart, $lte: monthEnd },
            });
            // 3. Check if we just hit a penalty threshold (i.e., count is a multiple of threshold)
            const penaltyApplied = lateCountThisMonth > 0 && lateCountThisMonth % threshold === 0;
            if (!penaltyApplied) {
                return { penaltyApplied: false, lateCountThisMonth, threshold };
            }
            // 4. Deduct 0.5 day from Casual Leave balance
            const deductionDays = 0.5;
            const result = await LeaveBalanceService_js_1.LeaveBalanceService.deductBalance(orgId, empId, 'Casual Leave', deductionDays);
            if (!result) {
                logger_js_1.logger.warn(`[LatePenaltyService] Could not deduct penalty for employee ${empId} — insufficient balance or no record.`);
                return {
                    penaltyApplied: false,
                    lateCountThisMonth,
                    threshold,
                    message: 'Penalty threshold crossed but balance deduction failed (insufficient balance).',
                };
            }
            // 5. Notify employee via Socket
            const io = (0, socketHandler_js_1.getIO)();
            if (io) {
                const empUser = await User_js_1.User.findOne({
                    $or: [{ employeeId: empId }, { email: employeeEmail }],
                    organizationId: orgId,
                });
                if (empUser) {
                    io.to(`user_${empUser._id}`).emit('receive_notification', {
                        _id: `late-penalty-${empId}-${monthStart}`,
                        title: 'Late Penalty Applied',
                        message: `You have accumulated ${lateCountThisMonth} late check-ins this month. 0.5 day deducted from your Casual Leave balance.`,
                        type: 'ATTENDANCE',
                        organizationId: orgId,
                    });
                }
            }
            logger_js_1.logger.info(`[LatePenaltyService] Late penalty applied: ${deductionDays} day for employee ${empId} (${lateCountThisMonth} late marks this month, threshold: ${threshold}).`);
            return {
                penaltyApplied: true,
                lateCountThisMonth,
                threshold,
                message: `0.5 day deducted from Casual Leave (${lateCountThisMonth} late marks this month, threshold: ${threshold}).`,
            };
        }
        catch (error) {
            logger_js_1.logger.error('[LatePenaltyService] evaluateAndApplyPenalty error', { error: error.message });
            return { penaltyApplied: false, lateCountThisMonth: 0, threshold: 3 };
        }
    }
}
exports.LatePenaltyService = LatePenaltyService;
