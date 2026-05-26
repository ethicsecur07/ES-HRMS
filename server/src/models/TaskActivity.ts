import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskActivity extends Document {
  organizationId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  actorName: string;
  action:
    | 'CREATED'
    | 'ASSIGNED'
    | 'STATUS_CHANGED'
    | 'SUBMITTED_FOR_REVIEW'
    | 'REVIEW_APPROVED'
    | 'REWORK_REQUESTED'
    | 'COMMENTED'
    | 'UPDATED'
    | 'DEADLINE_UPDATED'
    | 'PRIORITY_CHANGED'
    | 'ATTACHMENT_ADDED';
  from?: string;
  to?: string;
  comment?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const taskActivitySchema = new Schema<ITaskActivity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATED',
        'ASSIGNED',
        'STATUS_CHANGED',
        'SUBMITTED_FOR_REVIEW',
        'REVIEW_APPROVED',
        'REWORK_REQUESTED',
        'COMMENTED',
        'UPDATED',
        'DEADLINE_UPDATED',
        'PRIORITY_CHANGED',
        'ATTACHMENT_ADDED',
      ],
    },
    from: { type: String },
    to: { type: String },
    comment: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TaskActivity = mongoose.model<ITaskActivity>('TaskActivity', taskActivitySchema);
