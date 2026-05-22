import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkflowNode {
  id: string; // unique node identifier (e.g. 'node-1')
  type: 'START' | 'APPROVAL' | 'CONDITION' | 'NOTIFICATION' | 'END';
  name: string;
  config: {
    approverRole?: string; // e.g. 'MANAGER', 'HR', 'CEO'
    approverUserId?: string; // direct assignment
    slaHours?: number; // SLA timer before alert/auto-action
    conditionField?: string; // For branching, e.g., 'amount'
    conditionOperator?: 'GT' | 'LT' | 'EQ' | 'NE';
    conditionValue?: any;
    nextNodes?: Record<string, string>; // Maps condition outcomes (e.g. 'true', 'false') to next node IDs
    timeoutAction?: 'AUTO_APPROVE' | 'AUTO_REJECT' | 'ESCALATE';
    escalationRole?: string; // Role to escalate to if timeoutAction is ESCALATE
  };
  uiMetadata?: {
    position: { x: number; y: number };
  };
}

export interface IWorkflowTemplate extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  triggerEvent: string; // e.g. 'LEAVE_REQUEST', 'EXPENSE_CLAIM'
  nodes: IWorkflowNode[];
  version: number;
  isPublished: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workflowNodeSchema = new Schema<IWorkflowNode>({
  id: { type: String, required: true },
  type: { type: String, enum: ['START', 'APPROVAL', 'CONDITION', 'NOTIFICATION', 'END'], required: true },
  name: { type: String, required: true },
  config: {
    approverRole: { type: String },
    approverUserId: { type: String },
    slaHours: { type: Number },
    conditionField: { type: String },
    conditionOperator: { type: String, enum: ['GT', 'LT', 'EQ', 'NE', 'IN'] },
    conditionValue: { type: Schema.Types.Mixed },
    nextNodes: { type: Map, of: String, default: {} },
    timeoutAction: { type: String, enum: ['AUTO_APPROVE', 'AUTO_REJECT', 'ESCALATE'] },
    escalationRole: { type: String },
  },
  uiMetadata: {
    position: {
      x: { type: Number },
      y: { type: Number }
    }
  }
});

const workflowTemplateSchema = new Schema<IWorkflowTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    triggerEvent: { type: String, required: true, index: true },
    nodes: { type: [workflowNodeSchema], default: [] },
    version: { type: Number, default: 1 },
    isPublished: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

workflowTemplateSchema.index({ organizationId: 1, triggerEvent: 1, version: 1 }, { unique: true });

export const WorkflowTemplate = mongoose.model<IWorkflowTemplate>('WorkflowTemplate', workflowTemplateSchema);
