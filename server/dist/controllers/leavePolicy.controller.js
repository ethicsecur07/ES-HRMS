"use strict";
/**
 * leavePolicy.controller.ts
 * --------------------------
 * Admin CRUD for configuring leave policies per leave type per organization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.togglePolicyStatus = exports.updatePolicy = exports.createPolicy = exports.getAllPolicies = void 0;
const LeavePolicy_js_1 = require("../models/LeavePolicy.js");
const User_js_1 = require("../models/User.js");
const Announcement_js_1 = require("../models/Announcement.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const logger_js_1 = require("../utils/logger.js");
const VALID_LEAVE_TYPES = [
    'Casual Leave',
    'Sick Leave',
    'WFH',
    'Permission',
    'Compensatory Off',
    'Unpaid Leave',
];
/**
 * GET /api/leave-policies
 * Returns all leave policies for the org (any authenticated user can view).
 */
const getAllPolicies = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const policies = await LeavePolicy_js_1.LeavePolicy.find({ organizationId: orgId }).sort({ leaveType: 1 });
        res.status(200).json({ policies });
    }
    catch (error) {
        logger_js_1.logger.error('[leavePolicy] getAllPolicies error', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch leave policies.' });
    }
};
exports.getAllPolicies = getAllPolicies;
/**
 * POST /api/leave-policies
 * Admin only — create a new leave policy for a leave type.
 */
const createPolicy = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const { leaveType, monthlyAllowance, carryForward, carryForwardLimit, sandwichLeaveRule, holidayOverlapRule, compensatoryOffEligibility, encashmentRule, latePenaltyCount, permissionConversionHours, halfDayEnabled, advanceNoticeDays, maxConsecutiveDays, applicableGender, probationExempt, permissionAutoConvert, } = req.body;
        if (!leaveType || monthlyAllowance === undefined) {
            res.status(400).json({ message: 'leaveType and monthlyAllowance are required.' });
            return;
        }
        if (!VALID_LEAVE_TYPES.includes(leaveType)) {
            res.status(400).json({ message: `Invalid leave type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}` });
            return;
        }
        const policy = await LeavePolicy_js_1.LeavePolicy.create({
            organizationId: orgId,
            leaveType,
            monthlyAllowance: Number(monthlyAllowance),
            carryForward: carryForward ?? false,
            carryForwardLimit: carryForwardLimit ?? 0,
            sandwichLeaveRule: sandwichLeaveRule ?? false,
            holidayOverlapRule: holidayOverlapRule ?? true,
            compensatoryOffEligibility: compensatoryOffEligibility ?? { canEarn: false, validityDays: 60 },
            encashmentRule: encashmentRule ?? { canEncash: false, maxEncashableDays: 10, encashmentRatePercentage: 100 },
            latePenaltyCount: latePenaltyCount ?? 3,
            permissionConversionHours: permissionConversionHours ?? 3,
            halfDayEnabled: halfDayEnabled ?? true,
            advanceNoticeDays: advanceNoticeDays ?? 0,
            maxConsecutiveDays: maxConsecutiveDays ?? 0,
            applicableGender: applicableGender ?? 'All',
            probationExempt: probationExempt ?? false,
            permissionAutoConvert: permissionAutoConvert ?? false,
            isActive: true,
        });
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_POLICY_CREATED', req.user.email, 'LEAVE_POLICY', policy.id, `Created ${leaveType} policy (${monthlyAllowance} days/month)`, orgId);
        try {
            const creator = await User_js_1.User.findById(req.user.id);
            await Announcement_js_1.Announcement.create({
                organizationId: orgId,
                title: `New Leave Policy: ${leaveType}`,
                content: `A new leave policy has been configured for ${leaveType} with a monthly allowance of ${monthlyAllowance} days. Applicable to: ${applicableGender || 'All'}.`,
                type: 'POLICY_CHANGE',
                createdBy: req.user.id,
                createdByName: creator?.name || req.user.email,
                createdByRole: req.user.role,
            });
        }
        catch (annError) {
            logger_js_1.logger.error('[leavePolicy] announcement creation failed in createPolicy', { error: annError.message });
        }
        res.status(201).json({ policy, message: 'Leave policy created successfully.' });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ message: 'A policy for this leave type already exists. Use the update endpoint.' });
            return;
        }
        logger_js_1.logger.error('[leavePolicy] createPolicy error', { error: error.message });
        res.status(500).json({ message: 'Failed to create leave policy.' });
    }
};
exports.createPolicy = createPolicy;
/**
 * PUT /api/leave-policies/:id
 * Admin only — update an existing leave policy.
 */
const updatePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const policy = await LeavePolicy_js_1.LeavePolicy.findOne({ _id: id, organizationId: orgId });
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
            'permissionAutoConvert', 'isActive',
        ];
        for (const field of updatableFields) {
            if (req.body[field] !== undefined) {
                policy[field] = req.body[field];
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
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_POLICY_UPDATED', req.user.email, 'LEAVE_POLICY', policy.id, `Updated ${policy.leaveType} policy`, orgId);
        try {
            const creator = await User_js_1.User.findById(req.user.id);
            await Announcement_js_1.Announcement.create({
                organizationId: orgId,
                title: `Leave Policy Updated: ${policy.leaveType}`,
                content: `The leave policy for ${policy.leaveType} has been updated. The monthly allowance is now set to ${policy.monthlyAllowance} days.`,
                type: 'POLICY_CHANGE',
                createdBy: req.user.id,
                createdByName: creator?.name || req.user.email,
                createdByRole: req.user.role,
            });
        }
        catch (annError) {
            logger_js_1.logger.error('[leavePolicy] announcement creation failed in updatePolicy', { error: annError.message });
        }
        res.status(200).json({ policy, message: 'Leave policy updated successfully.' });
    }
    catch (error) {
        logger_js_1.logger.error('[leavePolicy] updatePolicy error', { error: error.message });
        res.status(500).json({ message: 'Failed to update leave policy.' });
    }
};
exports.updatePolicy = updatePolicy;
/**
 * PATCH /api/leave-policies/:id/toggle
 * Admin only — toggle active/inactive status for a leave policy.
 */
const togglePolicyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const policy = await LeavePolicy_js_1.LeavePolicy.findOne({ _id: id, organizationId: orgId });
        if (!policy) {
            res.status(404).json({ message: 'Leave policy not found in your organization.' });
            return;
        }
        policy.isActive = !policy.isActive;
        await policy.save();
        await (0, auditLog_service_js_1.createAuditLog)('LEAVE_POLICY_TOGGLE', req.user.email, 'LEAVE_POLICY', policy.id, `${policy.leaveType} policy set to ${policy.isActive ? 'ACTIVE' : 'INACTIVE'}`, orgId);
        try {
            const creator = await User_js_1.User.findById(req.user.id);
            await Announcement_js_1.Announcement.create({
                organizationId: orgId,
                title: `Leave Policy status changed: ${policy.leaveType}`,
                content: `The leave policy for ${policy.leaveType} has been ${policy.isActive ? 'activated' : 'deactivated'} by management.`,
                type: 'POLICY_CHANGE',
                createdBy: req.user.id,
                createdByName: creator?.name || req.user.email,
                createdByRole: req.user.role,
            });
        }
        catch (annError) {
            logger_js_1.logger.error('[leavePolicy] announcement creation failed in togglePolicyStatus', { error: annError.message });
        }
        res.status(200).json({
            policy,
            message: `${policy.leaveType} policy is now ${policy.isActive ? 'active' : 'inactive'}.`,
        });
    }
    catch (error) {
        logger_js_1.logger.error('[leavePolicy] togglePolicyStatus error', { error: error.message });
        res.status(500).json({ message: 'Failed to toggle policy status.' });
    }
};
exports.togglePolicyStatus = togglePolicyStatus;
