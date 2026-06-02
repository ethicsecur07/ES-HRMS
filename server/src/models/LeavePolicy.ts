import mongoose, { Schema, Document } from 'mongoose';

export interface ILeavePolicy extends Document {
  organizationId: mongoose.Types.ObjectId;
  leaveType: 'Casual Leave' | 'Sick Leave' | 'WFH' | 'Permission' | 'Compensatory Off' | 'Unpaid Leave';
  monthlyAllowance: number;
  carryForward: boolean;
  carryForwardLimit?: number;
  sandwichLeaveRule: boolean; // if True, holidays between leaves count as leave
  holidayOverlapRule: boolean; // if True, holidays overlapping leave do not count as leave
  compensatoryOffEligibility: {
    canEarn: boolean;
    validityDays?: number; // Days after which comp off expires
  };
  encashmentRule: {
    canEncash: boolean;
    maxEncashableDays?: number;
    encashmentRatePercentage?: number; // e.g. 100% of base salary, 50% etc.
  };
  latePenaltyCount: number; // e.g. 3 late check-ins -> 0.5 leave deduction
  permissionConversionHours: number; // e.g. 3 hours permission limit, excess converts to half-day
  halfDayEnabled: boolean;
  advanceNoticeDays: number;
  maxConsecutiveDays: number;
  applicableGender: 'All' | 'Male' | 'Female';
  probationExempt: boolean;
  permissionAutoConvert: boolean;
  applicableTo?: 'ALL' | 'EMPLOYEE' | 'INTERN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const leavePolicySchema = new Schema<ILeavePolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    leaveType: {
      type: String,
      enum: ['Casual Leave', 'Sick Leave', 'WFH', 'Permission', 'Compensatory Off', 'Unpaid Leave'],
      required: true,
    },
    monthlyAllowance: { type: Number, required: true },
    carryForward: { type: Boolean, default: false },
    carryForwardLimit: { type: Number, default: 0 },
    sandwichLeaveRule: { type: Boolean, default: false },
    holidayOverlapRule: { type: Boolean, default: true },
    compensatoryOffEligibility: {
      canEarn: { type: Boolean, default: false },
      validityDays: { type: Number, default: 60 }
    },
    encashmentRule: {
      canEncash: { type: Boolean, default: false },
      maxEncashableDays: { type: Number, default: 10 },
      encashmentRatePercentage: { type: Number, default: 100 }
    },
    latePenaltyCount: { type: Number, default: 3 },
    permissionConversionHours: { type: Number, default: 3 },
    halfDayEnabled: { type: Boolean, default: false },
    advanceNoticeDays: { type: Number, default: 0 },
    maxConsecutiveDays: { type: Number, default: 0 },
    applicableGender: { type: String, enum: ['All', 'Male', 'Female'], default: 'All' },
    probationExempt: { type: Boolean, default: false },
    permissionAutoConvert: { type: Boolean, default: false },
    applicableTo: { type: String, enum: ['ALL', 'EMPLOYEE', 'INTERN'], default: 'ALL' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

leavePolicySchema.index({ organizationId: 1, leaveType: 1, applicableTo: 1 }, { unique: true });

export const LeavePolicy = mongoose.model<ILeavePolicy>('LeavePolicy', leavePolicySchema);
