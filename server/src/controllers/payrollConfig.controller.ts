import { Response } from 'express';
import mongoose from 'mongoose';
import { PayrollConfig, DEFAULT_PAYROLL_CONFIG } from '../models/payroll/PayrollConfig.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';

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

    let config = await PayrollConfig.findOne({ organizationId: orgId, employeeId: targetEmployeeId });

    if (!config) {
      if (targetEmployeeId !== null) {
        // Fall back to organization's default config
        const defaultConfig = await PayrollConfig.findOne({ organizationId: orgId, employeeId: null });
        if (defaultConfig) {
          res.status(200).json({ config: defaultConfig });
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
      });
      return;
    }

    res.status(200).json({ config });
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
      pfEmployerPercent,
      gratuityPercent,
      esiEmployerPercent,
      insuranceMonthly,
      applyEsiOnlyIfGrossBelow21000,
      bulkApplyToAllEmployees,
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
      pfEmployerPercent: pfEmployerPercent ?? DEFAULT_PAYROLL_CONFIG.pfEmployerPercent,
      gratuityPercent: gratuityPercent ?? DEFAULT_PAYROLL_CONFIG.gratuityPercent,
      esiEmployerPercent: esiEmployerPercent ?? DEFAULT_PAYROLL_CONFIG.esiEmployerPercent,
      insuranceMonthly: insuranceMonthly ?? DEFAULT_PAYROLL_CONFIG.insuranceMonthly,
      applyEsiOnlyIfGrossBelow21000: applyEsiOnlyIfGrossBelow21000 ?? DEFAULT_PAYROLL_CONFIG.applyEsiOnlyIfGrossBelow21000,
    };

    if (bulkApplyToAllEmployees === true) {
      const { Employee } = await import('../models/Employee.js');
      const employees = await Employee.find({ organizationId: orgId, isActive: true });
      
      const bulkOps: any[] = employees.map(emp => ({
        updateOne: {
          filter: { organizationId: new mongoose.Types.ObjectId(orgId), employeeId: emp._id },
          update: { $set: { ...configData, organizationId: new mongoose.Types.ObjectId(orgId), employeeId: emp._id } },
          upsert: true
        }
      }));

      bulkOps.push({
        updateOne: {
          filter: { organizationId: new mongoose.Types.ObjectId(orgId), employeeId: null },
          update: { $set: { ...configData, organizationId: new mongoose.Types.ObjectId(orgId), employeeId: null } },
          upsert: true
        }
      });

      if (bulkOps.length > 0) {
        await PayrollConfig.bulkWrite(bulkOps as any);
      }

      const config = await PayrollConfig.findOne({ organizationId: orgId, employeeId: null });

      await createAuditLog(
        'PAYROLL_CONFIG_BULK_UPDATE',
        req.user?.email || 'Admin',
        'PAYROLL',
        orgId.toString(),
        `Bulk payroll configuration applied to organization defaults and all ${employees.length} active employees`,
        req.user?.organizationId
      );

      res.status(200).json({ config, message: `Payroll configuration applied to organization defaults and all ${employees.length} active employees successfully.` });
      return;
    }

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
