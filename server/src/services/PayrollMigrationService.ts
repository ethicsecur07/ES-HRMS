import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { SalaryComponent } from '../models/payroll/SalaryComponent.js';
import { SalaryStructure } from '../models/payroll/SalaryStructure.js';
import { TaxSlab } from '../models/payroll/TaxSlab.js';
import { createAuditLog } from './auditLog.service.js';

export interface MigrationPayload {
  salaryComponents: {
    name: string;
    type: 'EARNING' | 'DEDUCTION' | 'CONTRIBUTION';
    calculationType: 'FIXED' | 'FORMULA';
    formula?: string;
    isTaxable: boolean;
    isConditional: boolean;
    conditionExpression?: string;
  }[];
  taxSlabs: {
    country: string;
    regime?: string;
    minIncome: number;
    maxIncome: number;
    taxRatePercentage: number;
    flatTaxAmount: number;
    effectiveYear: number;
  }[];
  salaryStructures: {
    employeeCode: string;
    baseSalary: number;
    components: {
      componentName: string;
      fixedValue?: number;
    }[];
    effectiveDate: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  }[];
}

export class PayrollMigrationService {
  /**
   * Imports historical payroll configs into the current tenant atomically.
   */
  static async runMigration(orgId: string | mongoose.Types.ObjectId, payload: MigrationPayload, emailForAudit: string) {
    const organizationId = new mongoose.Types.ObjectId(orgId.toString());
    const session = await mongoose.startSession();
    session.startTransaction();

    const results = {
      componentsImported: 0,
      slabsImported: 0,
      structuresImported: 0,
      errors: [] as string[]
    };

    try {
      // 1. Import Salary Components
      const componentMap = new Map<string, mongoose.Types.ObjectId>();
      if (payload.salaryComponents && Array.isArray(payload.salaryComponents)) {
        for (const comp of payload.salaryComponents) {
          try {
            if (!comp.name || !comp.type || !comp.calculationType) {
              results.errors.push(`Invalid component skipped: ${JSON.stringify(comp)}`);
              continue;
            }

            const doc = await SalaryComponent.findOneAndUpdate(
              { organizationId, name: comp.name.trim() },
              { $set: comp },
              { upsert: true, new: true, session }
            );
            componentMap.set(comp.name.trim(), doc._id as mongoose.Types.ObjectId);
            results.componentsImported++;
          } catch (e: any) {
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

            await TaxSlab.findOneAndUpdate(
              {
                organizationId,
                country: slab.country,
                regime: slab.regime || '',
                minIncome: slab.minIncome,
                maxIncome: slab.maxIncome,
                effectiveYear: slab.effectiveYear || 2026
              },
              { $set: slab },
              { upsert: true, session }
            );
            results.slabsImported++;
          } catch (e: any) {
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
            const employee = await Employee.findOne({
              organizationId,
              employeeCode: struct.employeeCode.trim()
            }).session(session);

            if (!employee) {
              results.errors.push(`Employee not found for code: ${struct.employeeCode}`);
              continue;
            }

            // Map component names to IDs
            const mappedComponents: any[] = [];
            for (const c of struct.components) {
              // Try to find the component in componentMap or query database
              let cId = componentMap.get(c.componentName.trim());
              if (!cId) {
                const existingComp = await SalaryComponent.findOne({
                  organizationId,
                  name: c.componentName.trim()
                }).session(session);
                if (existingComp) {
                  cId = existingComp._id as mongoose.Types.ObjectId;
                }
              }

              if (cId) {
                mappedComponents.push({
                  componentId: cId,
                  fixedValue: c.fixedValue
                });
              } else {
                results.errors.push(`Salary component '${c.componentName}' not found for structure of employee: ${struct.employeeCode}`);
              }
            }

            // Upsert salary structure
            await SalaryStructure.findOneAndUpdate(
              {
                organizationId,
                employeeId: employee._id,
                status: 'ACTIVE' // Auto-archive old ones or replace active
              },
              {
                $set: {
                  baseSalary: struct.baseSalary,
                  components: mappedComponents,
                  effectiveDate: struct.effectiveDate ? new Date(struct.effectiveDate) : new Date(),
                  status: struct.status || 'ACTIVE'
                }
              },
              { upsert: true, session }
            );
            results.structuresImported++;
          } catch (e: any) {
            results.errors.push(`Salary structure import error for employee ${struct.employeeCode}: ${e.message}`);
          }
        }
      }

      if (results.errors.length > 0 && results.structuresImported === 0) {
        throw new Error(`Migration aborted. No salary structures could be imported. Errors: ${results.errors.join(', ')}`);
      }

      await createAuditLog(
        'PAYROLL_MIGRATION_RUN',
        emailForAudit,
        'PAYROLL',
        'MIGRATION',
        `Successfully run payroll migration: imported ${results.componentsImported} components, ${results.slabsImported} slabs, ${results.structuresImported} structures.`,
        organizationId
      );

      await session.commitTransaction();
      session.endSession();
      return results;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}
