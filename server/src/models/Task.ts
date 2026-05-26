import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  sprintName?: string;
  sprintId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  assignedTo: mongoose.Types.ObjectId;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  epicId?: mongoose.Types.ObjectId;
  parentTaskId?: mongoose.Types.ObjectId;
  dependencies: mongoose.Types.ObjectId[];
  storyPoints: number;
  actualHours: number;
  tags?: string[];
  checklist?: { label: string; done: boolean }[];
  attachments?: { filename: string; url: string; fileType?: string; uploadedByName: string; uploadedAt: string }[];
  reworkCount: number;
  reworkComments?: { comment: string; by: string; byName: string; at: string }[];
  reviewNotes?: string;
  completionNotes?: string;
  progressSummary?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    sprintName: { type: String },
    sprintId: { type: Schema.Types.ObjectId, ref: 'Sprint', index: true },
    title: { type: String, required: true },
    description: { type: String },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'],
      default: 'TODO',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    dueDate: { type: String },
    epicId: { type: Schema.Types.ObjectId, ref: 'Epic' },
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
    storyPoints: { type: Number, default: 0 },
    actualHours: { type: Number, default: 0 },
    tags: [{ type: String }],
    checklist: [
      {
        label: { type: String, required: true },
        done: { type: Boolean, default: false },
      },
    ],
    attachments: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String },
        uploadedByName: { type: String, required: true },
        uploadedAt: { type: String, required: true },
      },
    ],
    reworkCount: { type: Number, default: 0 },
    reworkComments: [
      {
        comment: { type: String, required: true },
        by: { type: String, required: true },
        byName: { type: String, required: true },
        at: { type: String, required: true },
      },
    ],
    reviewNotes: { type: String },
    completionNotes: { type: String },
    progressSummary: { type: String },
    submittedAt: { type: String },
    reviewedAt: { type: String },
  },
  { timestamps: true }
);

export const Task = mongoose.model<ITask>('Task', taskSchema);
