import mongoose, { Schema, Document } from 'mongoose';

export interface ISprint {
  name: string;
  startDate: string;
  endDate: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED';
}

export interface IProject extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  clientName: string;
  startDate: string;
  endDate: string;
  budget: number;
  budgetStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  allocatedManagerId: mongoose.Types.ObjectId;
  teamMemberIds: mongoose.Types.ObjectId[];
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  milestones: {
    name: string;
    dueDate: string;
    status: 'PENDING' | 'COMPLETED';
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    clientName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    budget: { type: Number, required: true, default: 0 },
    budgetStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    allocatedManagerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamMemberIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    status: {
      type: String,
      enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'],
      default: 'PLANNING',
    },
    milestones: [
      {
        name: { type: String, required: true },
        dueDate: { type: String, required: true },
        status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
      },
    ],
  },
  { timestamps: true }
);

projectSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Project = mongoose.model<IProject>('Project', projectSchema);
