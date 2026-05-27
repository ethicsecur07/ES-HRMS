import { Response } from 'express';
import { PayrollConfig, DEFAULT_PAYROLL_CONFIG } from '../models/payroll/PayrollConfig.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';
import { Leave } from '../models/Leave.js';
import { PermissionRequest } from '../models/PermissionRequest.js';
import { Organization } from '../models/Organization.js';

/**
 * GET /api/payroll-config
 * Fetch the organization's payroll configuration. Returns defaults if none saved.
 */
export const getPayrollConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { employeeId } = req.query;
    const targetEmployeeId = employeeId ? employeeId : null;

    let stats = null;
    if (orgId && targetEmployeeId) {
      const org = await Organization.findById(orgId);
      const startDay = org?.settings?.payrollCycleStartDay || 1;

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      let runCycleYear = year;
      let runCycleMonth = month;
      const day = today.getDate();

      if (startDay > 1 && day < startDay) {
        // We are still in the cycle that ends in this month (started in the previous month)
      } else if (startDay > 1 && day >= startDay) {
        // We are in the cycle that starts in this month and ends in the next month
        runCycleMonth++;
        if (runCycleMonth > 12) {
          runCycleMonth = 1;
          runCycleYear++;
        }
      }

      const monthStr = runCycleMonth < 10 ? `0${runCycleMonth}` : `${runCycleMonth}`;
      const runCycle = `${runCycleYear}-${monthStr}`;

      // Calculate cycle start and end dates
      let startStr = '';
      let endStr = '';
      if (startDay <= 1) {
        const lastDay = new Date(runCycleYear, runCycleMonth, 0).getDate();
        startStr = `${runCycle}-01`;
        endStr = `${runCycle}-${lastDay < 10 ? '0' + lastDay : lastDay}`;
      } else {
        const prevDate = new Date(runCycleYear, runCycleMonth - 2, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth() + 1;
        const prevMonthStr = prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`;
        const startDayStr = startDay < 10 ? `0${startDay}` : `${startDay}`;
        startStr = `${prevYear}-${prevMonthStr}-${startDayStr}`;

        const endDayVal = startDay - 1;
        const endDayStr = endDayVal < 10 ? `0${endDayVal}` : `${endDayVal}`;
        endStr = `${runCycleYear}-${monthStr}-${endDayStr}`;
      }

      const cycleStart = new Date(startStr);
      const cycleEnd = new Date(endStr);

      const approvedLeaves = await Leave.find({
        organizationId: orgId,
        employeeId: targetEmployeeId,
        status: 'APPROVED',
        startDate: { $lte: endStr },
        endDate: { $gte: startStr }
      });

      let casualLeaveDays = 0;
      for (const leave of approvedLeaves) {
        if (leave.leaveType === 'Casual Leave') {
          const s = new Date(leave.startDate) > cycleStart ? new Date(leave.startDate) : cycleStart;
          const e = new Date(leave.endDate) < cycleEnd ? new Date(leave.endDate) : cycleEnd;
          let days = s > e ? 0 : Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (leave.isHalfDay) days = 0.5;
          casualLeaveDays += days;
        }
      }

      const approvedPermissions = await PermissionRequest.find({
        organizationId: orgId,
        employeeId: targetEmployeeId,
        approvalStatus: 'APPROVED',
        date: { $gte: startStr, $lte: endStr }
      });
      const totalPermissionHours = approvedPermissions.reduce((sum, p) => sum + (p.totalHours || 0), 0);

      stats = {
        runCycle,
        startStr,
        endStr,
        casualLeaveDays,
        totalPermissionHours,
      };
    }

    let config = await PayrollConfig.findOne({ organizationId: orgId, employeeId: targetEmployeeId });

    if (!config) {
      if (targetEmployeeId !== null) {
        // Fall back to organization's default config
        const defaultConfig = await PayrollConfig.findOne({ organizationId: orgId, employeeId: null });
        if (defaultConfig) {
          res.status(200).json({ config: defaultConfig, stats });
          return;
        }
      }

      // Return defaults (not persisted yet)
      res.status(200).json({
        config: {
          ...DEFAULT_PAYROLL_CONFIG,
          organizationId: orgId,
          employeeId: targetEmployeeId,
          _id: null,
        },
        stats,
      });
      return;
    }

    res.status(200).json({ config, stats });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/payroll-config
 * Save or update the organization's payroll configuration.
 * Only ADMIN and HR roles can perform this action.
 */
export const savePayrollConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const {
      employeeId,
      basicSalaryPercent,
      hraPercent,
      conveyanceMonthly,
      performanceIncentiveMonthly,
      otherAllowancesMonthly,
      pfEmployeePercent,
      professionalTaxMonthly,
      incomeTaxTdsMonthly,
      lossOfPayPerLeaveDay,
      lossOfPayPerPermissionHour,
      pfEmployerPercent,
      gratuityPercent,
      esiEmployerPercent,
      insuranceMonthly,
      applyEsiOnlyIfGrossBelow21000,
    } = req.body;

    const targetEmployeeId = employeeId ? employeeId : null;

    const configData = {
      basicSalaryPercent: basicSalaryPercent ?? DEFAULT_PAYROLL_CONFIG.basicSalaryPercent,
      hraPercent: hraPercent ?? DEFAULT_PAYROLL_CONFIG.hraPercent,
      conveyanceMonthly: conveyanceMonthly ?? DEFAULT_PAYROLL_CONFIG.conveyanceMonthly,
      performanceIncentiveMonthly: performanceIncentiveMonthly ?? DEFAULT_PAYROLL_CONFIG.performanceIncentiveMonthly,
      otherAllowancesMonthly: otherAllowancesMonthly ?? DEFAULT_PAYROLL_CONFIG.otherAllowancesMonthly,
      pfEmployeePercent: pfEmployeePercent ?? DEFAULT_PAYROLL_CONFIG.pfEmployeePercent,
      professionalTaxMonthly: professionalTaxMonthly ?? DEFAULT_PAYROLL_CONFIG.professionalTaxMonthly,
      incomeTaxTdsMonthly: incomeTaxTdsMonthly ?? DEFAULT_PAYROLL_CONFIG.incomeTaxTdsMonthly,
      lossOfPayPerLeaveDay: lossOfPayPerLeaveDay ?? DEFAULT_PAYROLL_CONFIG.lossOfPayPerLeaveDay,
      lossOfPayPerPermissionHour: lossOfPayPerPermissionHour ?? DEFAULT_PAYROLL_CONFIG.lossOfPayPerPermissionHour,
      pfEmployerPercent: pfEmployerPercent ?? DEFAULT_PAYROLL_CONFIG.pfEmployerPercent,
      gratuityPercent: gratuityPercent ?? DEFAULT_PAYROLL_CONFIG.gratuityPercent,
      esiEmployerPercent: esiEmployerPercent ?? DEFAULT_PAYROLL_CONFIG.esiEmployerPercent,
      insuranceMonthly: insuranceMonthly ?? DEFAULT_PAYROLL_CONFIG.insuranceMonthly,
      applyEsiOnlyIfGrossBelow21000: applyEsiOnlyIfGrossBelow21000 ?? DEFAULT_PAYROLL_CONFIG.applyEsiOnlyIfGrossBelow21000,
    };

    const config = await PayrollConfig.findOneAndUpdate(
      { organizationId: orgId, employeeId: targetEmployeeId },
      { ...configData, organizationId: orgId, employeeId: targetEmployeeId },
      { upsert: true, new: true, runValidators: true }
    );

    await createAuditLog(
      'PAYROLL_CONFIG_UPDATE',
      req.user?.email || 'Admin',
      'PAYROLL',
      config._id?.toString() || '',
      targetEmployeeId 
        ? `Payroll configuration updated for employee ID: ${targetEmployeeId}`
        : 'Global payroll configuration updated',
      req.user?.organizationId
    );

    res.status(200).json({ config, message: 'Payroll configuration saved successfully.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
