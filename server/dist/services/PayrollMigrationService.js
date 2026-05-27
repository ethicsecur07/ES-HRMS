"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollMigrationService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Employee_js_1 = require("../models/Employee.js");
const SalaryComponent_js_1 = require("../models/payroll/SalaryComponent.js");
const SalaryStructure_js_1 = require("../models/payroll/SalaryStructure.js");
const TaxSlab_js_1 = require("../models/payroll/TaxSlab.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
class PayrollMigrationService {
    /**
     * Imports historical payroll configs into the current tenant atomically.
     */
    static async runMigration(orgId, payload, emailForAudit) {
        const organizationId = new mongoose_1.default.Types.ObjectId(orgId.toString());
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        const results = {
            componentsImported: 0,
            slabsImported: 0,
            structuresImported: 0,
            errors: []
        };
        try {
            // 1. Import Salary Components
            const componentMap = new Map();
            if (payload.salaryComponents && Array.isArray(payload.salaryComponents)) {
                for (const comp of payload.salaryComponents) {
                    try {
                        if (!comp.name || !comp.type || !comp.calculationType) {
                            results.errors.push(`Invalid component skipped: ${JSON.stringify(comp)}`);
                            continue;
                        }
                        const doc = await SalaryComponent_js_1.SalaryComponent.findOneAndUpdate({ organizationId, name: comp.name.trim() }, { $set: comp }, { upsert: true, new: true, session });
                        componentMap.set(comp.name.trim(), doc._id);
                        results.componentsImported++;
                    }
                    catch (e) {
                        results.errors.push(`Component import error: ${e.message}`);
                    }
                }
            }
            // 2. Import Tax Slabs
            if (payload.taxSlabs && Array.isArray(payload.taxSlabs)) {
                for (const slab of payload.taxSlabs) {
                    try {
                        if (!slab.country || slab.minIncome === undefined || slab.maxIncome === undefined || slab.taxRatePercentage === undefined) {
                            results.errors.push(`Invalid tax slab skipped: ${JSON.stringify(slab)}`);
                            continue;
                        }
                        await TaxSlab_js_1.TaxSlab.findOneAndUpdate({
                            organizationId,
                            country: slab.country,
                            regime: slab.regime || '',
                            minIncome: slab.minIncome,
                            maxIncome: slab.maxIncome,
                            effectiveYear: slab.effectiveYear || 2026
                        }, { $set: slab }, { upsert: true, session });
                        results.slabsImported++;
                    }
                    catch (e) {
                        results.errors.push(`Tax slab import error: ${e.message}`);
                    }
                }
            }
            // 3. Import Employee Salary Structures (and link them to dynamic components)
            if (payload.salaryStructures && Array.isArray(payload.salaryStructures)) {
                for (const struct of payload.salaryStructures) {
                    try {
                        if (!struct.employeeCode || struct.baseSalary === undefined) {
                            results.errors.push(`Invalid structure skipped: ${JSON.stringify(struct)}`);
                            continue;
                        }
                        // Find matching employee in this organization
                        const employee = await Employee_js_1.Employee.findOne({
                            organizationId,
                            employeeCode: struct.employeeCode.trim()
                        }).session(session);
                        if (!employee) {
                            results.errors.push(`Employee not found for code: ${struct.employeeCode}`);
                            continue;
                        }
                        // Map component names to IDs
                        const mappedComponents = [];
                        for (const c of struct.components) {
                            // Try to find the component in componentMap or query database
                            let cId = componentMap.get(c.componentName.trim());
                            if (!cId) {
                                const existingComp = await SalaryComponent_js_1.SalaryComponent.findOne({
                                    organizationId,
                                    name: c.componentName.trim()
                                }).session(session);
                                if (existingComp) {
                                    cId = existingComp._id;
                                }
                            }
                            if (cId) {
                                mappedComponents.push({
                                    componentId: cId,
                                    fixedValue: c.fixedValue
                                });
                            }
                            else {
                                results.errors.push(`Salary component '${c.componentName}' not found for structure of employee: ${struct.employeeCode}`);
                            }
                        }
                        // Upsert salary structure
                        await SalaryStructure_js_1.SalaryStructure.findOneAndUpdate({
                            organizationId,
                            employeeId: employee._id,
                            status: 'ACTIVE' // Auto-archive old ones or replace active
                        }, {
                            $set: {
                                baseSalary: struct.baseSalary,
                                components: mappedComponents,
                                effectiveDate: struct.effectiveDate ? new Date(struct.effectiveDate) : new Date(),
                                status: struct.status || 'ACTIVE'
                            }
                        }, { upsert: true, session });
                        results.structuresImported++;
                    }
                    catch (e) {
                        results.errors.push(`Salary structure import error for employee ${struct.employeeCode}: ${e.message}`);
                    }
                }
            }
            if (results.errors.length > 0 && results.structuresImported === 0) {
                throw new Error(`Migration aborted. No salary structures could be imported. Errors: ${results.errors.join(', ')}`);
            }
            await (0, auditLog_service_js_1.createAuditLog)('PAYROLL_MIGRATION_RUN', emailForAudit, 'PAYROLL', 'MIGRATION', `Successfully run payroll migration: imported ${results.componentsImported} components, ${results.slabsImported} slabs, ${results.structuresImported} structures.`, organizationId);
            await session.commitTransaction();
            session.endSession();
            return results;
        }
        catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }
}
exports.PayrollMigrationService = PayrollMigrationService;
