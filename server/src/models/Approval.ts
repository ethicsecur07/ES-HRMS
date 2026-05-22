import mongoose, { Schema, Document } from 'mongoose';

export interface IApprovalStep {
  roleCode: string; // e.g. 'TEAM_LEAD', 'HR', 'ADMIN'
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  actionById?: mongoose.Types.ObjectId; // User who took the action
  actionDate?: Date;
  comments?: string;
}

export interface IApproval extends Document {
  organizationId: mongoose.Types.ObjectId;
  refModel: 'Leave' | 'WFHRequest' | 'PermissionRequest' | 'Expense';
  refId: mongoose.Types.ObjectId;
  workflowChain: IApprovalStep[];
  currentStepIndex: number;
  finalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

const approvalSchema = new Schema<IApproval>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    refModel: {
      type: String,
      enum: ['Leave', 'WFHRequest', 'PermissionRequest', 'Expense'],
      required: true,
      index: true,
    },
    refId: { type: Schema.Types.ObjectId, required: true, index: true },
    workflowChain: [
      {
        roleCode: { type: String, required: true },
        status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
        actionById: { type: Schema.Types.ObjectId, ref: 'User' },
        actionDate: { type: Date },
        comments: { type: String },
      },
    ],
    currentStepIndex: { type: Number, default: 0 },
    finalStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
  },
  { timestamps: true }
);

export const Approval = mongoose.model<IApproval>('Approval', approvalSchema);
