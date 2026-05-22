import mongoose, { Schema, Document } from 'mongoose';

export interface IPayslip extends Document {
  organizationId: mongoose.Types.ObjectId;
  payrollId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  allowances: {
    basic: number;
    hra: number;
    conveyance: number;
    medical: number;
    bonus: number;
    overtime: number;
  };
  deductions: {
    professionalTax: number;
    providentFund: number;
    leaveDeductions: number;
    latePenalties: number;
    tax: number;
  };
  reimbursements: number;
  netSalary: number;
  generatedAt: Date;
}

const payslipSchema = new Schema<IPayslip>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    payrollId: { type: Schema.Types.ObjectId, ref: 'Payroll', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true },
    allowances: {
      basic: { type: Number, required: true },
      hra: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      bonus: { type: Number, default: 0 },
      overtime: { type: Number, default: 0 },
    },
    deductions: {
      professionalTax: { type: Number, default: 0 },
      providentFund: { type: Number, default: 0 },
      leaveDeductions: { type: Number, default: 0 },
      latePenalties: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },
    reimbursements: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

payslipSchema.index({ employeeId: 1, month: 1 }, { unique: true });

export const Payslip = mongoose.model<IPayslip>('Payslip', payslipSchema);
