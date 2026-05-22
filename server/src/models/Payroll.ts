import mongoose, { Schema, Document } from 'mongoose';

export interface IPayroll extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  baseSalary: number;
  overtime: number;
  bonus: number;
  reimbursements: number;
  tax: number;
  leaveDeductions: number;
  deductions: number;
  finalSalary: number;
  paidStatus: 'PAID' | 'PENDING' | 'PROCESSING';
  paymentDate?: Date;
  payslipUrl?: string;
}

const payrollSchema = new Schema<IPayroll>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, index: true },
    baseSalary: { type: Number, required: true },
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    reimbursements: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    leaveDeductions: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    finalSalary: { type: Number, required: true },
    paidStatus: { type: String, enum: ['PAID', 'PENDING', 'PROCESSING'], default: 'PENDING' },
    paymentDate: { type: Date },
    payslipUrl: { type: String },
  },
  { timestamps: true }
);

import { softDeletePlugin } from '../utils/softDeletePlugin.js';

payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });
payrollSchema.plugin(softDeletePlugin);

export const Payroll = mongoose.model<IPayroll>('Payroll', payrollSchema);
