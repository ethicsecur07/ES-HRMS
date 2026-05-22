import mongoose, { Schema, Document } from 'mongoose';

export const LEAVE_BALANCE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'WFH',
  'Permission',
  'Compensatory Off',
  'Earned Leave',
  'Unpaid Leave',
] as const;

export type LeaveBalanceType = typeof LEAVE_BALANCE_TYPES[number];

export interface ILeaveBalance extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  leaveType: LeaveBalanceType;
  allocated: number;
  used: number;
  balance: number;
  lastAccrualPeriod?: string; // YYYY-MM of last accrual (for idempotency)
  createdAt: Date;
  updatedAt: Date;
}

const leaveBalanceSchema = new Schema<ILeaveBalance>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: {
      type: String,
      enum: LEAVE_BALANCE_TYPES,
      required: true,
    },
    allocated: { type: Number, required: true, default: 0 },
    used: { type: Number, default: 0 },
    balance: { type: Number, required: true, default: 0 },
    lastAccrualPeriod: { type: String }, // YYYY-MM
  },
  { timestamps: true }
);

// Tenant-safe unique index: orgId + employeeId + leaveType
leaveBalanceSchema.index({ organizationId: 1, employeeId: 1, leaveType: 1 }, { unique: true });
// Fast lookup by org for resets and reporting
leaveBalanceSchema.index({ organizationId: 1, leaveType: 1 });

export const LeaveBalance = mongoose.model<ILeaveBalance>('LeaveBalance', leaveBalanceSchema);
