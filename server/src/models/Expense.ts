import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  organizationId: mongoose.Types.ObjectId;
  amount: number;
  category: string; // e.g., 'Travel', 'Office Supplies', 'Client Dinner'
  reason: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  workflowInstanceId?: mongoose.Types.ObjectId;
  attachmentUrl?: string; // S3 or Cloudinary link
  date: string; // YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    reason: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    workflowInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance' },
    attachmentUrl: { type: String },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
