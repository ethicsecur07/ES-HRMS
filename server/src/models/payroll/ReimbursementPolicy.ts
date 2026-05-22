import mongoose, { Schema, Document } from 'mongoose';

export interface IReimbursementPolicy extends Document {
  organizationId: mongoose.Types.ObjectId;
  category: string; // e.g., 'Travel', 'Meals', 'Internet'
  maxClaimAmount: number;
  requireReceiptAbove: number;
  eligibleRoles: mongoose.Types.ObjectId[];
  isActive: boolean;
}

const reimbursementPolicySchema = new Schema<IReimbursementPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    category: { type: String, required: true },
    maxClaimAmount: { type: Number, required: true },
    requireReceiptAbove: { type: Number, required: true, default: 0 },
    eligibleRoles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ReimbursementPolicy = mongoose.model<IReimbursementPolicy>('ReimbursementPolicy', reimbursementPolicySchema);
