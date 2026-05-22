import mongoose, { Schema, Document } from 'mongoose';

export interface IEpic extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  targetDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const epicSchema = new Schema<IEpic>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
    targetDate: { type: String },
  },
  { timestamps: true }
);

export const Epic = mongoose.model<IEpic>('Epic', epicSchema);
