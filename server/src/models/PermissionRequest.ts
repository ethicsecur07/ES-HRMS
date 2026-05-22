import mongoose, { Schema, Document } from 'mongoose';
import { APPROVAL_STATUS } from '../constants/index.js';

export interface IPermissionRequest extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  reason: string;
  approvalStatus: string;
  appliedAt: Date;
  approvedBy?: mongoose.Types.ObjectId;
}

const permissionRequestSchema = new Schema<IPermissionRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    totalHours: { type: Number, required: true },
    reason: { type: String, required: true },
    approvalStatus: { type: String, enum: Object.values(APPROVAL_STATUS), default: APPROVAL_STATUS.PENDING },
    appliedAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PermissionRequest = mongoose.model<IPermissionRequest>('PermissionRequest', permissionRequestSchema);
