"use strict";
/**
 * LeavePolicyEngine.ts
 * ---------------------
 * Centralized, tenant-aware leave policy evaluation engine.
 * All policy rules come from the database — NO hardcoded values.
 * Used by all leave services and controllers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeavePolicyEngine = void 0;
const LeavePolicy_js_1 = require("../../../models/LeavePolicy.js");
const LeaveBalance_js_1 = require("../../../models/LeaveBalance.js");
const HolidayCalendar_js_1 = require("../../../models/HolidayCalendar.js");
const Organization_js_1 = require("../../../models/Organization.js");
const Employee_js_1 = require("../../../models/Employee.js");
class LeavePolicyEngine {
    static async getPolicy(organizationId, leaveType, isIntern = false) {
        let policy = await LeavePolicy_js_1.LeavePolicy.findOne({
            organizationId,
            leaveType,
            isActive: true,
            applicableTo: isIntern ? 'INTERN' : 'EMPLOYEE'
        });
        if (!policy) {
            policy = await LeavePolicy_js_1.LeavePolicy.findOne({
                organizationId,
                leaveType,
                isActive: true,
                applicableTo: 'ALL'
            });
        }
        if (!policy) {
            throw new Error(`No active leave policy found for type '${leaveType}' in this organization.`);
        }
        return policy;
    }
    /**
     * Check if an employee has enough balance for the requested leave.
     */
    static async checkBalance(organizationId, employeeId, leaveType, requiredDays) {
        const balance = await LeaveBalance_js_1.LeaveBalance.findOne({
            organizationId,
            employeeId,
            leaveType,
        });
        const currentBalance = balance?.balance ?? 0;
        const deficit = Math.max(0, requiredDays - currentBalance);
        return {
            hasEnoughBalance: currentBalance >= requiredDays,
            currentBalance,
            requiredDays,
            deficit,
        };
    }
    /**
     * Calculate working days between two dates, respecting:
     * - Weekends (Sat/Sun by default, or org workdays config)
     * - Organization holidays from HolidayCalendar
     * - Sandwich leave rule from policy
     */
    static async calculateLeaveDuration(organizationId, leaveType, startDate, endDate, employeeId) {
        // Check if the employee is an intern
        let isIntern = false;
        if (employeeId) {
            const employee = await Employee_js_1.Employee.findById(employeeId);
            isIntern = !!(employee?.isIntern || employee?.designation?.toLowerCase().includes('intern') || employee?.department?.toLowerCase().includes('intern'));
        }
        // Load policy and org settings using getPolicy helper
        const policy = await this.getPolicy(organizationId, leaveType, isIntern).catch(() => null);
        const org = await Organization_js_1.Organization.findById(organizationId);
        const activeWorkdays = org?.settings?.activeWorkdays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const sandwichApplies = policy?.sandwichLeaveRule ?? false;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            throw new Error('End date cannot be before start date.');
        }
        // Load all holidays for this org in the date range
        const holidays = await HolidayCalendar_js_1.HolidayCalendar.find({
            organizationId,
            date: { $gte: startDate, $lte: endDate },
        });
        const holidaySet = new Set(holidays.map((h) => h.date));
        const holidayNames = holidays.map((h) => h.name);
        const dayNameMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        let calendarDays = 0;
        let businessDays = 0;
        let weekendDays = 0;
        let holidayDays = 0;
        const curDate = new Date(start);
        while (curDate <= end) {
            const dayName = dayNameMap[curDate.getDay()];
            const dateStr = curDate.toISOString().split('T')[0];
            const isWorkday = activeWorkdays.includes(dayName);
            const isHoliday = holidaySet.has(dateStr);
            calendarDays++;
            if (!isWorkday) {
                weekendDays++;
            }
            else if (isHoliday) {
                holidayDays++;
            }
            else {
                businessDays++;
            }
            curDate.setDate(curDate.getDate() + 1);
        }
        // Sandwich rule: include weekends & holidays between leave dates
        const finalDeductionDays = sandwichApplies ? calendarDays : businessDays;
        return {
            calendarDays,
            businessDays,
            holidayDays,
            weekendDays,
            sandwichApplies,
            finalDeductionDays,
            holidayNames,
        };
    }
    /**
     * Validate policy constraints for a leave request.
     * Returns an array of violations (empty = valid).
     */
    static async validateLeaveRequest(params) {
        const violations = [];
        const { organizationId, employeeId, leaveType, startDate, endDate, totalDays } = params;
        // 1. Basic date validation
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            violations.push({ code: 'INVALID_DATE', message: 'Invalid start or end date format.' });
            return violations; // Cannot continue if dates are bad
        }
        if (end < start) {
            violations.push({ code: 'DATE_RANGE_ERROR', message: 'End date must be on or after start date.' });
        }
        // 2. Policy check
        const employee = await Employee_js_1.Employee.findById(employeeId);
        const isIntern = !!(employee?.isIntern || employee?.designation?.toLowerCase().includes('intern') || employee?.department?.toLowerCase().includes('intern'));
        const policy = await this.getPolicy(organizationId, leaveType, isIntern).catch(() => null);
        if (!policy) {
            violations.push({ code: 'NO_POLICY', message: `No active policy found for leave type '${leaveType}'.` });
            return violations;
        }
        // 3. Balance check
        const balanceResult = await this.checkBalance(organizationId, employeeId, leaveType, totalDays);
        if (!balanceResult.hasEnoughBalance) {
            violations.push({
                code: 'INSUFFICIENT_BALANCE',
                message: `Insufficient balance. Available: ${balanceResult.currentBalance} days, Required: ${totalDays} days.`,
            });
        }
        return violations;
    }
    /**
     * Validate permission hours request server-side.
     */
    static calculatePermissionHours(startTime, endTime) {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        if (endMinutes <= startMinutes) {
            throw new Error('Permission end time must be after start time.');
        }
        return parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
    }
    /**
     * Check if employee has exceeded monthly permission hours.
     */
    static async checkMonthlyPermissionLimit(organizationId, employeeId, requestedHours) {
        const employee = await Employee_js_1.Employee.findById(employeeId);
        const isIntern = !!(employee?.isIntern || employee?.designation?.toLowerCase().includes('intern') || employee?.department?.toLowerCase().includes('intern'));
        const policy = await this.getPolicy(organizationId, 'Permission', isIntern).catch(() => null);
        // Fallback to org settings, then hardcoded default
        const org = await Organization_js_1.Organization.findById(organizationId);
        const limitHours = policy?.permissionConversionHours ?? org?.settings?.monthlyPermissionHours ?? 3;
        const balance = await LeaveBalance_js_1.LeaveBalance.findOne({ organizationId, employeeId, leaveType: 'Permission' });
        const usedHours = balance?.used ?? 0;
        const remainingHours = parseFloat((limitHours - usedHours).toFixed(2));
        return {
            allowed: requestedHours <= remainingHours,
            usedHours,
            limitHours,
            remainingHours,
        };
    }
}
exports.LeavePolicyEngine = LeavePolicyEngine;
