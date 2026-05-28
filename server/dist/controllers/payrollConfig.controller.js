"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.savePayrollConfig = exports.getPayrollConfig = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
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
        const { employeeId } = req.query;
        const targetEmployeeId = employeeId ? employeeId : null;
        let config = await PayrollConfig_js_1.PayrollConfig.findOne({ organizationId: orgId, employeeId: targetEmployeeId });
        if (!config) {
            if (targetEmployeeId !== null) {
                // Fall back to organization's default config
                const defaultConfig = await PayrollConfig_js_1.PayrollConfig.findOne({ organizationId: orgId, employeeId: null });
                if (defaultConfig) {
                    res.status(200).json({ config: defaultConfig });
                    return;
                }
            }
            // Return defaults (not persisted yet)
            res.status(200).json({
                config: {
                    ...PayrollConfig_js_1.DEFAULT_PAYROLL_CONFIG,
                    organizationId: orgId,
                    employeeId: targetEmployeeId,
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
        const { employeeId, basicSalaryPercent, hraPercent, conveyanceMonthly, performanceIncentiveMonthly, otherAllowancesMonthly, pfEmployeePercent, professionalTaxMonthly, incomeTaxTdsMonthly, pfEmployerPercent, gratuityPercent, esiEmployerPercent, insuranceMonthly, applyEsiOnlyIfGrossBelow21000, bulkApplyToAllEmployees, } = req.body;
        const targetEmployeeId = employeeId ? employeeId : null;
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
        if (bulkApplyToAllEmployees === true) {
            const { Employee } = await import('../models/Employee.js');
            const employees = await Employee.find({ organizationId: orgId, isActive: true });
            const bulkOps = employees.map(emp => ({
                updateOne: {
                    filter: { organizationId: new mongoose_1.default.Types.ObjectId(orgId), employeeId: emp._id },
                    update: { $set: { ...configData, organizationId: new mongoose_1.default.Types.ObjectId(orgId), employeeId: emp._id } },
                    upsert: true
                }
            }));
            bulkOps.push({
                updateOne: {
                    filter: { organizationId: new mongoose_1.default.Types.ObjectId(orgId), employeeId: null },
                    update: { $set: { ...configData, organizationId: new mongoose_1.default.Types.ObjectId(orgId), employeeId: null } },
                    upsert: true
                }
            });
            if (bulkOps.length > 0) {
                await PayrollConfig_js_1.PayrollConfig.bulkWrite(bulkOps);
            }
            const config = await PayrollConfig_js_1.PayrollConfig.findOne({ organizationId: orgId, employeeId: null });
            await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_CONFIG_BULK_UPDATE', req.user?.email || 'Admin', 'PAYROLL', orgId.toString(), `Bulk payroll configuration applied to organization defaults and all ${employees.length} active employees`, req.user?.organizationId);
            res.status(200).json({ config, message: `Payroll configuration applied to organization defaults and all ${employees.length} active employees successfully.` });
            return;
        }
        const config = await PayrollConfig_js_1.PayrollConfig.findOneAndUpdate({ organizationId: orgId, employeeId: targetEmployeeId }, { ...configData, organizationId: orgId, employeeId: targetEmployeeId }, { upsert: true, new: true, runValidators: true });
        await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_CONFIG_UPDATE', req.user?.email || 'Admin', 'PAYROLL', config._id?.toString() || '', targetEmployeeId
            ? `Payroll configuration updated for employee ID: ${targetEmployeeId}`
            : 'Global payroll configuration updated', req.user?.organizationId);
        res.status(200).json({ config, message: 'Payroll configuration saved successfully.' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.savePayrollConfig = savePayrollConfig;
