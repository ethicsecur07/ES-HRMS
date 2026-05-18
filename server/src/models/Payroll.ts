import mongoose, { Schema, Document } from 'mongoose';

export interface IPayroll extends Document {
  employeeId: mongoose.Types.ObjectId;
  month: string; // YYYY-MM
  baseSalary: number;
  deductions: number;
  bonus: number;
  finalSalary: number;
  paidStatus: 'PAID' | 'PENDING' | 'PROCESSING';
  paymentDate?: Date;
  payslipUrl?: string;
}

const payrollSchema = new Schema<IPayroll>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: String, required: true, index: true },
    baseSalary: { type: Number, required: true },
    deductions: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    finalSalary: { type: Number, required: true },
    paidStatus: { type: String, enum: ['PAID', 'PENDING', 'PROCESSING'], default: 'PENDING' },
    paymentDate: { type: Date },
    payslipUrl: { type: String },
  },
  { timestamps: true }
);

payrollSchema.index({ employeeId: 1, month: 1 }, { unique: true });

export const Payroll = mongoose.model<IPayroll>('Payroll', payrollSchema);
