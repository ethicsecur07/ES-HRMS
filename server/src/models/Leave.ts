import mongoose, { Schema, Document } from 'mongoose';

export const LEAVE_TYPES_ALL = [
  'Casual Leave',
  'Sick Leave',
  'WFH',
  'Permission',
  'Compensatory Off',
  'Earned Leave',
  'Unpaid Leave',
] as const;

export type LeaveTypeAll = typeof LEAVE_TYPES_ALL[number];

export const LEAVE_STATUS_ALL = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export type LeaveStatusAll = typeof LEAVE_STATUS_ALL[number];

export interface ILeave extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  leaveType: LeaveTypeAll;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  totalDays: number; // Server-calculated — never trust client
  isHalfDay: boolean;
  halfDaySession?: 'MORNING' | 'AFTERNOON';
  reason: string;
  status: LeaveStatusAll;
  appliedAt: Date;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  expectedTasks?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
}

const leaveSchema = new Schema<ILeave>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPES_ALL, required: true, index: true },
    startDate: { type: String, required: true, index: true },
    endDate: { type: String, required: true },
    totalDays: { type: Number, required: true, min: 0 },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ['MORNING', 'AFTERNOON'] },
    reason: { type: String, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: LEAVE_STATUS_ALL,
      default: 'PENDING',
      index: true,
    },
    appliedAt: { type: Date, default: Date.now },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String, maxlength: 500 },
    expectedTasks: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound index for fast org-scoped queries with status filtering
leaveSchema.index({ organizationId: 1, status: 1, startDate: -1 });
leaveSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
leaveSchema.index({ organizationId: 1, employeeId: 1, startDate: 1, endDate: 1 });

export const Leave = mongoose.model<ILeave>('Leave', leaveSchema);
