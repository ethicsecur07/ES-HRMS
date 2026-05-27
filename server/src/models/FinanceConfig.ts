import mongoose, { Schema, Document } from 'mongoose';

export interface IFinanceConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  budgetCategories: string[];
  expenseTypes: string[];
  approvalWorkflow: {
    role: string;
    step: number;
  }[];
  rules: {
    maxExpenseLimit: number;
    requireReceiptAbove: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const financeConfigSchema = new Schema<IFinanceConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
    budgetCategories: { type: [String], default: ['Monthly Office Maintenance Budget', 'Departmental Operations', 'Hardware & Assets'] },
    expenseTypes: { type: [String], default: ['AC Servicing', 'High-Speed Internet', 'Hardware purchase', 'Office Supplies', 'Team Outing'] },
    approvalWorkflow: [
      {
        role: { type: String, required: true },
        step: { type: Number, required: true }
      }
    ],
    rules: {
      maxExpenseLimit: { type: Number, default: 50000 },
      requireReceiptAbove: { type: Number, default: 1000 }
    }
  },
  { timestamps: true }
);

export const FinanceConfig = mongoose.model<IFinanceConfig>('FinanceConfig', financeConfigSchema);
