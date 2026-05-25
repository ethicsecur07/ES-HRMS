"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployeeLeaveBalances = exports.getMyLeaveBalances = exports.getLeaveAnalytics = exports.submitEncashment = exports.checkSandwichRule = exports.runAutomatedAccruals = exports.getLeaveV2Summary = void 0;
const LeavePolicy_js_1 = require("../../models/LeavePolicy.js");
const LeaveBalance_js_1 = require("../../models/LeaveBalance.js");
const Leave_js_1 = require("../../models/Leave.js");
const Employee_js_1 = require("../../models/Employee.js");
const User_js_1 = require("../../models/User.js");
const LeaveAccrualService_js_1 = require("./services/LeaveAccrualService.js");
const LeaveAnalyticsService_js_1 = require("./services/LeaveAnalyticsService.js");
const LeavePolicyEngine_js_1 = require("./policies/LeavePolicyEngine.js");
const auditLog_service_js_1 = require("../../services/auditLog.service.js");
/**
 * GET /api/v2/leave/summary
 * Returns policies, balances, and accurate pending counts.
 */
const getLeaveV2Summary = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const [policies, balances, pendingCounts, balanceDistribution] = await Promise.all([
            LeavePolicy_js_1.LeavePolicy.find({ organizationId: orgId }),
            LeaveBalance_js_1.LeaveBalance.find({ organizationId: orgId }).populate('employeeId', 'fullName employeeCode department'),
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getPendingApprovalCount(orgId),
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getBalanceDistribution(orgId),
        ]);
        res.json({
            policies,
            balances,
            pendingCounts, // Accurate: includes Leave + WFH + Permission
            balanceDistribution,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getLeaveV2Summary = getLeaveV2Summary;
/**
 * POST /api/v2/leave/accrue
 * Run leave accrual for the organization — idempotent, bulk, org-scoped.
 */
const runAutomatedAccruals = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const period = req.body.period; // Optional: override period (YYYY-MM)
        const result = await LeaveAccrualService_js_1.LeaveAccrualService.runMonthlyAccrual(orgId, period);
        if (result.skippedDuplicates > 0) {
            res.json({
                success: false,
                message: `Accrual already ran for period ${result.period}. Skipped to prevent double accrual.`,
                result,
            });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_ACCRUAL_MANUAL', req.user.email, 'LEAVE', `${result.employeesProcessed} employees`, `Manual accrual triggered for period ${result.period}`, orgId);
        res.json({
            success: true,
            message: `Accrual engine processed ${result.employeesProcessed} employees with ${result.balancesUpdated} balance updates.`,
            result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.runAutomatedAccruals = runAutomatedAccruals;
/**
 * POST /api/v2/leave/sandwich-check
 * Calculate sandwich leave with actual org holidays.
 */
const checkSandwichRule = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { startDate, endDate, leaveType } = req.body;
        if (!orgId || !startDate || !endDate || !leaveType) {
            res.status(400).json({ message: 'organizationId, startDate, endDate, and leaveType are required' });
            return;
        }
        // Use LeavePolicyEngine which now includes org holidays
        let durationResult;
        try {
            durationResult = await LeavePolicyEngine_js_1.LeavePolicyEngine.calculateLeaveDuration(orgId, leaveType, startDate, endDate);
        }
        catch (err) {
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
    }
    catch (err) {
        next(err);
    }
};
exports.checkSandwichRule = checkSandwichRule;
/**
 * POST /api/v2/leave/encash
 * Submit encashment request — creates a Leave record with status PENDING for approval.
 * Does NOT directly deduct balance (requires HR approval workflow first).
 */
const submitEncashment = async (req, res, next) => {
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
        const policy = await LeavePolicy_js_1.LeavePolicy.findOne({ organizationId: orgId, leaveType, isActive: true });
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
        const balanceCheck = await LeavePolicyEngine_js_1.LeavePolicyEngine.checkBalance(orgId, empId, leaveType, encashDays);
        if (!balanceCheck.hasEnoughBalance) {
            res.status(400).json({
                message: `Insufficient balance. Available: ${balanceCheck.currentBalance} days, Requested: ${encashDays} days.`,
            });
            return;
        }
        // Create an encashment request record (pending HR approval)
        const encashRequest = await Leave_js_1.Leave.create({
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
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_ENCASH_REQUEST', req.user.email, 'LEAVE', encashRequest.id, `Encashment request for ${encashDays} days of ${leaveType} (rate: ${policy.encashmentRule.encashmentRatePercentage}%)`, orgId);
        res.status(201).json({
            success: true,
            message: `Encashment request for ${encashDays} days of ${leaveType} submitted. Pending HR approval.`,
            encashRequest,
            note: 'Balance will be deducted only after HR approval.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.submitEncashment = submitEncashment;
/**
 * GET /api/v2/leave/analytics
 * Leave analytics for the organization.
 */
const getLeaveAnalytics = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const [trends, departmentStats, absenteeism, balanceDistribution] = await Promise.all([
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getLeaveTrends(orgId, 6),
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getDepartmentLeaveStats(orgId),
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getAbsenteeismReport(orgId, 10),
            LeaveAnalyticsService_js_1.LeaveAnalyticsService.getBalanceDistribution(orgId),
        ]);
        res.json({
            trends,
            departmentStats,
            absenteeism,
            balanceDistribution,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getLeaveAnalytics = getLeaveAnalytics;
/**
 * GET /api/v2/leave/balance/me
 * Employee self-service: fetch own leave balances across all types.
 */
const getMyLeaveBalances = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        // Resolve employeeId from user
        const user = await User_js_1.User.findOne({ _id: userId, organizationId: orgId });
        let empId = user?.employeeId?.toString();
        if (!empId) {
            const emp = await Employee_js_1.Employee.findOne({ email: user?.email, organizationId: orgId });
            empId = emp?._id.toString();
        }
        if (!empId) {
            res.json({ data: { balances: [], employeeId: null }, message: 'Employee profile not found.' });
            return;
        }
        const [balances, policies] = await Promise.all([
            LeaveBalance_js_1.LeaveBalance.find({ organizationId: orgId, employeeId: empId }),
            LeavePolicy_js_1.LeavePolicy.find({ organizationId: orgId, isActive: true }),
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
    }
    catch (err) {
        next(err);
    }
};
exports.getMyLeaveBalances = getMyLeaveBalances;
/**
 * GET /api/v2/leave/balance/:empId
 * Admin/HR: fetch leave balances for a specific employee.
 */
const getEmployeeLeaveBalances = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { empId } = req.params;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const balances = await LeaveBalance_js_1.LeaveBalance.find({ organizationId: orgId, employeeId: empId });
        res.json({ balances, employeeId: empId });
    }
    catch (err) {
        next(err);
    }
};
exports.getEmployeeLeaveBalances = getEmployeeLeaveBalances;
