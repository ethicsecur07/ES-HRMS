import mongoose, { Schema, Document } from 'mongoose';
import { APPROVAL_STATUS, LEAVE_TYPES } from '../constants/index.js';

export interface ILeave extends Document {
  employeeId: mongoose.Types.ObjectId;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  appliedAt: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  expectedTasks?: string;
}

const leaveSchema = new Schema<ILeave>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: String, enum: Object.values(LEAVE_TYPES), required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    totalDays: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.PENDING },
    appliedAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    expectedTasks: { type: String },
  },
  { timestamps: true }
);

export const Leave = mongoose.model<ILeave>('Leave', leaveSchema);
