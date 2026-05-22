import mongoose, { Schema, Document } from 'mongoose';

export interface IApprovalLog {
  nodeId: string;
  nodeName: string;
  approverUserId?: mongoose.Types.ObjectId;
  approverRole?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  actionTakenAt?: Date;
  comments?: string;
}

export interface IWorkflowInstance extends Document {
  organizationId: mongoose.Types.ObjectId;
  workflowTemplateId: mongoose.Types.ObjectId;
  refModel: string; // e.g., 'Leave', 'Expense'
  refId: mongoose.Types.ObjectId;
  currentNodeId: string;
  status: 'ACTIVE' | 'APPROVED' | 'REJECTED' | 'TERMINATED';
  history: IApprovalLog[];
  createdAt: Date;
  updatedAt: Date;
}

const approvalLogSchema = new Schema<IApprovalLog>({
  nodeId: { type: String, required: true },
  nodeName: { type: String, required: true },
  approverUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  approverRole: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'], default: 'PENDING' },
  actionTakenAt: { type: Date },
  comments: { type: String },
});

const workflowInstanceSchema = new Schema<IWorkflowInstance>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    workflowTemplateId: { type: Schema.Types.ObjectId, ref: 'WorkflowTemplate', required: true, index: true },
    refModel: { type: String, required: true },
    refId: { type: Schema.Types.ObjectId, required: true, index: true },
    currentNodeId: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'APPROVED', 'REJECTED', 'TERMINATED'], default: 'ACTIVE', index: true },
    history: { type: [approvalLogSchema], default: [] },
  },
  { timestamps: true }
);

export const WorkflowInstance = mongoose.model<IWorkflowInstance>('WorkflowInstance', workflowInstanceSchema);
