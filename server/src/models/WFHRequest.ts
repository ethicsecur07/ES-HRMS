import mongoose, { Schema, Document } from 'mongoose';
import { APPROVAL_STATUS } from '../constants/index.js';

export interface IWFHRequest extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  expectedTasks: string;
  status: string;
  appliedAt: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

const wfhRequestSchema = new Schema<IWFHRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    totalDays: { type: Number, required: true },
    reason: { type: String, required: true },
    expectedTasks: { type: String, required: true },
    status: { type: String, enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.PENDING },
    appliedAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);

export const WFHRequest = mongoose.model<IWFHRequest>('WFHRequest', wfhRequestSchema);
