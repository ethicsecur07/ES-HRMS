import mongoose, { Schema, Document } from 'mongoose';

export interface IPayrollRun extends Document {
  organizationId: mongoose.Types.ObjectId;
  runCycle: string; // YYYY-MM
  status: 'DRAFT' | 'LOCKED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  totalProcessedCount: number;
  totalFailedCount: number;
  totalPayoutAmount: number;
  approvedBy?: mongoose.Types.ObjectId;
  processingLog: string[]; // basic logs of errors
}

const payrollRunSchema = new Schema<IPayrollRun>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    runCycle: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'LOCKED', 'PROCESSING', 'COMPLETED', 'FAILED', 'ROLLED_BACK'], default: 'DRAFT' },
    totalProcessedCount: { type: Number, default: 0 },
    totalFailedCount: { type: Number, default: 0 },
    totalPayoutAmount: { type: Number, default: 0 },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processingLog: [{ type: String }]
  },
  { timestamps: true }
);

payrollRunSchema.index({ organizationId: 1, runCycle: 1 }, { unique: true });

export const PayrollRun = mongoose.model<IPayrollRun>('PayrollRun', payrollRunSchema);
