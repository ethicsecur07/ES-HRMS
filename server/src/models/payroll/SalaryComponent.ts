import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../../utils/softDeletePlugin.js';

export interface ISalaryComponent extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // e.g., "Basic Salary", "HRA", "PF Deduction"
  type: 'EARNING' | 'DEDUCTION' | 'CONTRIBUTION';
  calculationType: 'FIXED' | 'FORMULA';
  formula?: string; // e.g., "Basic * 0.4"
  isTaxable: boolean;
  isConditional: boolean;
  conditionExpression?: string; // e.g., "Base > 50000"
  isActive: boolean;
}

const salaryComponentSchema = new Schema<ISalaryComponent>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['EARNING', 'DEDUCTION', 'CONTRIBUTION'], required: true },
    calculationType: { type: String, enum: ['FIXED', 'FORMULA'], required: true },
    formula: { type: String },
    isTaxable: { type: Boolean, default: true },
    isConditional: { type: Boolean, default: false },
    conditionExpression: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

salaryComponentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
salaryComponentSchema.plugin(softDeletePlugin);

export const SalaryComponent = mongoose.model<ISalaryComponent>('SalaryComponent', salaryComponentSchema);
