"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePayrollConfig = exports.getPayrollConfig = void 0;
const PayrollConfig_js_1 = require("../models/payroll/PayrollConfig.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
/**
 * GET /api/payroll-config
 * Fetch the organization's payroll configuration. Returns defaults if none saved.
 */
const getPayrollConfig = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        let config = await PayrollConfig_js_1.PayrollConfig.findOne({ organizationId: orgId });
        if (!config) {
            // Return defaults (not persisted yet)
            res.status(200).json({
                config: {
                    ...PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG,
                    organizationId: orgId,
                    _id: null,
                },
            });
            return;
        }
        res.status(200).json({ config });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPayrollConfig = getPayrollConfig;
/**
 * PUT /api/payroll-config
 * Save or update the organization's payroll configuration.
 * Only ADMIN and HR roles can perform this action.
 */
const savePayrollConfig = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { basicSalaryPercent, hraPercent, conveyanceMonthly, performanceIncentiveMonthly, otherAllowancesMonthly, pfEmployeePercent, professionalTaxMonthly, incomeTaxTdsMonthly, pfEmployerPercent, gratuityPercent, esiEmployerPercent, insuranceMonthly, applyEsiOnlyIfGrossBelow21000, } = req.body;
        const configData = {
            basicSalaryPercent: basicSalaryPercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.basicSalaryPercent,
            hraPercent: hraPercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.hraPercent,
            conveyanceMonthly: conveyanceMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.conveyanceMonthly,
            performanceIncentiveMonthly: performanceIncentiveMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.performanceIncentiveMonthly,
            otherAllowancesMonthly: otherAllowancesMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.otherAllowancesMonthly,
            pfEmployeePercent: pfEmployeePercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.pfEmployeePercent,
            professionalTaxMonthly: professionalTaxMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.professionalTaxMonthly,
            incomeTaxTdsMonthly: incomeTaxTdsMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.incomeTaxTdsMonthly,
            pfEmployerPercent: pfEmployerPercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.pfEmployerPercent,
            gratuityPercent: gratuityPercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.gratuityPercent,
            esiEmployerPercent: esiEmployerPercent ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.esiEmployerPercent,
            insuranceMonthly: insuranceMonthly ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.insuranceMonthly,
            applyEsiOnlyIfGrossBelow21000: applyEsiOnlyIfGrossBelow21000 ?? PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG.applyEsiOnlyIfGrossBelow21000,
        };
        const config = await PayrollConfig_js_1.PayrollConfig.findOneAndUpdate({ organizationId: orgId }, { ...configData, organizationId: orgId }, { upsert: true, new: true, runValidators: true });
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_CONFIG_UPDATE', req.user?.email || 'Admin', 'PAYROLL', config._id?.toString() || '', 'Payroll configuration updated', req.user?.organizationId);
        res.status(200).json({ config, message: 'Payroll configuration saved successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.savePayrollConfig = savePayrollConfig;
