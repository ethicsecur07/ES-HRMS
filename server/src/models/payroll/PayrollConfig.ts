import mongoose, { Schema, Document } from 'mongoose';

export interface IPayrollConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId | null;

  // Earnings (CTC Breakup)
  basicSalaryPercent: number;           // % of CTC (default 40)
  hraPercent: number;                   // % of Basic (default 40)
  conveyanceMonthly: number;            // Fixed monthly amount (default 1600)
  performanceIncentiveMonthly: number;  // Fixed monthly amount (default 0)
  otherAllowancesMonthly: number;       // Fixed monthly amount (default 0)

  // Deductions
  pfEmployeePercent: number;            // % of Basic (default 12)
  professionalTaxMonthly: number;       // Fixed monthly amount (default 200)
  incomeTaxTdsMonthly: number;          // Fixed monthly amount (default 0)

  // Employer Contributions
  pfEmployerPercent: number;            // % of Basic (default 12)
  gratuityPercent: number;              // % of Basic (default 4.81)
  esiEmployerPercent: number;           // % of Gross (default 3.25)
  insuranceMonthly: number;             // Fixed monthly amount (default 0)

  // ESI Toggle
  applyEsiOnlyIfGrossBelow21000: boolean; // default true
}

const payrollConfigSchema = new Schema<IPayrollConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },

    // Earnings
    basicSalaryPercent: { type: Number, default: 40, min: 0, max: 100 },
    hraPercent: { type: Number, default: 40, min: 0, max: 100 },
    conveyanceMonthly: { type: Number, default: 1600, min: 0 },
    performanceIncentiveMonthly: { type: Number, default: 0, min: 0 },
    otherAllowancesMonthly: { type: Number, default: 0, min: 0 },

    // Deductions
    pfEmployeePercent: { type: Number, default: 12, min: 0, max: 100 },
    professionalTaxMonthly: { type: Number, default: 200, min: 0 },
    incomeTaxTdsMonthly: { type: Number, default: 0, min: 0 },

    // Employer Contributions
    pfEmployerPercent: { type: Number, default: 12, min: 0, max: 100 },
    gratuityPercent: { type: Number, default: 4.81, min: 0, max: 100 },
    esiEmployerPercent: { type: Number, default: 3.25, min: 0, max: 100 },
    insuranceMonthly: { type: Number, default: 0, min: 0 },

    // ESI Toggle
    applyEsiOnlyIfGrossBelow21000: { type: Boolean, default: true },
  },
  { timestamps: true }
);

payrollConfigSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });

export const PayrollConfig = mongoose.model<IPayrollConfig>('PayrollConfig', payrollConfigSchema);

// Default config values used when no org config exists
export const DEFAULT_PAYROLL_CONFIG = {
  basicSalaryPercent: 40,
  hraPercent: 40,
  conveyanceMonthly: 1600,
  performanceIncentiveMonthly: 0,
  otherAllowancesMonthly: 0,
  pfEmployeePercent: 12,
  professionalTaxMonthly: 200,
  incomeTaxTdsMonthly: 0,
  pfEmployerPercent: 12,
  gratuityPercent: 4.81,
  esiEmployerPercent: 3.25,
  insuranceMonthly: 0,
  applyEsiOnlyIfGrossBelow21000: true,
};
