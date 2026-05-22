"use strict";
/**
 * LeaveAnalyticsService.ts
 * ------------------------
 * Tenant-safe, optimized leave analytics using MongoDB aggregation.
 * Replaces in-memory filtering in the analytics controller.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveAnalyticsService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Leave_js_1 = require("../../../models/Leave.js");
const LeaveBalance_js_1 = require("../../../models/LeaveBalance.js");
const PermissionRequest_js_1 = require("../../../models/PermissionRequest.js");
class LeaveAnalyticsService {
    /**
     * Unified pending approvals count (Leave + WFH + Permission).
     * Fixes: dashboard showing only Leave count.
     */
    static async getPendingApprovalCount(organizationId) {
        const orgObjectId = new mongoose_1.default.Types.ObjectId(organizationId);
        const [leaveCount, wfhCount, permCount] = await Promise.all([
            Leave_js_1.Leave.countDocuments({ organizationId, leaveType: { $ne: 'WFH' }, status: 'PENDING' }),
            Leave_js_1.Leave.countDocuments({ organizationId, leaveType: 'WFH', status: 'PENDING' }),
            PermissionRequest_js_1.PermissionRequest.countDocuments({ organizationId, approvalStatus: 'PENDING' }),
        ]);
        return {
            total: leaveCount + wfhCount + permCount,
            leaves: leaveCount,
            wfh: wfhCount,
            permissions: permCount,
        };
    }
    /**
     * Leave trends by month for an organization.
     * Returns aggregated leave counts per month per type.
     */
    static async getLeaveTrends(organizationId, months = 6) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const startStr = startDate.toISOString().split('T')[0];
        const results = await Leave_js_1.Leave.aggregate([
            {
                $match: {
                    organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                    status: 'APPROVED',
                    startDate: { $gte: startStr },
                },
            },
            {
                $group: {
                    _id: {
                        month: { $substr: ['$startDate', 0, 7] }, // YYYY-MM
                        leaveType: '$leaveType',
                    },
                    count: { $sum: 1 },
                    totalDays: { $sum: '$totalDays' },
                },
            },
            {
                $project: {
                    _id: 0,
                    month: '$_id.month',
                    leaveType: '$_id.leaveType',
                    count: 1,
                    totalDays: 1,
                },
            },
            { $sort: { month: 1, leaveType: 1 } },
        ]);
        return results;
    }
    /**
     * Department-level leave analytics.
     */
    static async getDepartmentLeaveStats(organizationId) {
        const orgObjectId = new mongoose_1.default.Types.ObjectId(organizationId);
        const results = await Leave_js_1.Leave.aggregate([
            {
                $match: { organizationId: orgObjectId },
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: 'employeeId',
                    foreignField: '_id',
                    as: 'employee',
                },
            },
            { $unwind: '$employee' },
            {
                $group: {
                    _id: '$employee.department',
                    totalLeaves: { $sum: 1 },
                    totalDays: { $sum: '$totalDays' },
                    pendingCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
                    },
                    approvedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] },
                    },
                    rejectedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] },
                    },
                },
            },
            {
                $project: {
                    _id: 0,
                    department: '$_id',
                    totalLeaves: 1,
                    totalDays: 1,
                    pendingCount: 1,
                    approvedCount: 1,
                    rejectedCount: 1,
                },
            },
            { $sort: { totalDays: -1 } },
        ]);
        return results;
    }
    /**
     * Leave balance distribution across all employees.
     */
    static async getBalanceDistribution(organizationId) {
        const results = await LeaveBalance_js_1.LeaveBalance.aggregate([
            { $match: { organizationId: new mongoose_1.default.Types.ObjectId(organizationId) } },
            {
                $group: {
                    _id: '$leaveType',
                    avgBalance: { $avg: '$balance' },
                    minBalance: { $min: '$balance' },
                    maxBalance: { $max: '$balance' },
                    totalAllocated: { $sum: '$allocated' },
                    totalUsed: { $sum: '$used' },
                },
            },
            {
                $project: {
                    _id: 0,
                    leaveType: '$_id',
                    avgBalance: { $round: ['$avgBalance', 2] },
                    minBalance: 1,
                    maxBalance: 1,
                    totalAllocated: 1,
                    totalUsed: 1,
                },
            },
        ]);
        return results;
    }
    /**
     * Absenteeism report — employees with most approved leave days.
     */
    static async getAbsenteeismReport(organizationId, topN = 10) {
        const results = await Leave_js_1.Leave.aggregate([
            {
                $match: {
                    organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                    status: 'APPROVED',
                    leaveType: { $ne: 'WFH' },
                },
            },
            {
                $group: {
                    _id: '$employeeId',
                    totalDays: { $sum: '$totalDays' },
                    leaveCount: { $sum: 1 },
                },
            },
            { $sort: { totalDays: -1 } },
            { $limit: topN },
            {
                $lookup: {
                    from: 'employees',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'employee',
                },
            },
            { $unwind: { path: '$employee', preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    _id: 0,
                    employeeId: '$_id',
                    fullName: '$employee.fullName',
                    department: '$employee.department',
                    totalDays: 1,
                    leaveCount: 1,
                },
            },
        ]);
        return results;
    }
    /**
     * Leave type breakdown for a specific employee (tenant-safe).
     */
    static async getEmployeeLeaveHistory(organizationId, employeeId) {
        const [balances, recentLeaves, summaryByType] = await Promise.all([
            LeaveBalance_js_1.LeaveBalance.find({ organizationId, employeeId }).lean(),
            Leave_js_1.Leave.find({ organizationId, employeeId })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean(),
            Leave_js_1.Leave.aggregate([
                {
                    $match: {
                        organizationId: new mongoose_1.default.Types.ObjectId(organizationId),
                        employeeId: new mongoose_1.default.Types.ObjectId(employeeId),
                        status: 'APPROVED',
                    },
                },
                {
                    $group: {
                        _id: '$leaveType',
                        count: { $sum: 1 },
                        totalDays: { $sum: '$totalDays' },
                    },
                },
                { $project: { _id: 0, leaveType: '$_id', count: 1, totalDays: 1 } },
            ]),
        ]);
        return { balances, recentLeaves, summaryByType };
    }
}
exports.LeaveAnalyticsService = LeaveAnalyticsService;
