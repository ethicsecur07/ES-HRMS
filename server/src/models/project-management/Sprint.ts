import mongoose, { Schema, Document } from 'mongoose';

export interface ISprint extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  goal?: string;
  startDate: string; // ISO String or YYYY-MM-DD
  endDate: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED';
  totalStoryPoints: number;
  completedStoryPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<ISprint>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    name: { type: String, required: true },
    goal: { type: String },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ['PLANNING', 'ACTIVE', 'COMPLETED'], default: 'PLANNING' },
    totalStoryPoints: { type: Number, default: 0 },
    completedStoryPoints: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Sprint = mongoose.model<ISprint>('Sprint', sprintSchema);
