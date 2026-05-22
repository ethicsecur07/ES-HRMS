import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

export interface ILifecycleStep {
  name: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  assignedTo?: mongoose.Types.ObjectId;
  completedAt?: Date;
  notes?: string;
}

const lifecycleStepSchema = new Schema<ILifecycleStep>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'], default: 'PENDING' },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: { type: Date },
  notes: { type: String }
});

export interface IEmployeeLifecycle extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  type: 'ONBOARDING' | 'PROBATION' | 'PROMOTION' | 'TRANSFER' | 'RESIGNATION' | 'EXIT';
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: Date;
  completionDate?: Date;
  steps: ILifecycleStep[];
  probationDetails?: {
    durationMonths: number;
    reviewDate: Date;
    rating?: number;
    isConfirmed: boolean;
  };
  promotionDetails?: {
    oldRoleCode: string;
    newRoleCode: string;
    oldSalary: number;
    newSalary: number;
    effectiveDate: Date;
  };
  transferDetails?: {
    oldBranchId?: mongoose.Types.ObjectId;
    newBranchId?: mongoose.Types.ObjectId;
    oldDepartment?: string;
    newDepartment?: string;
    effectiveDate: Date;
  };
  resignationDetails?: {
    resignationDate: Date;
    lastWorkingDay: Date;
    reason: string;
    exitInterviewCompleted: boolean;
  };
  offboardingChecklist?: {
    assetsReturned: boolean;
    itAccessRevoked: boolean;
    payrollSettled: boolean;
    clearanceCertificateIssued: boolean;
  };
}

const employeeLifecycleSchema = new Schema<IEmployeeLifecycle>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: {
      type: String,
      enum: ['ONBOARDING', 'PROBATION', 'PROMOTION', 'TRANSFER', 'RESIGNATION', 'EXIT'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['INITIATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'INITIATED',
    },
    startDate: { type: Date, required: true, default: Date.now },
    completionDate: { type: Date },
    steps: [lifecycleStepSchema],
    probationDetails: {
      durationMonths: { type: Number },
      reviewDate: { type: Date },
      rating: { type: Number },
      isConfirmed: { type: Boolean, default: false },
    },
    promotionDetails: {
      oldRoleCode: { type: String },
      newRoleCode: { type: String },
      oldSalary: { type: Number },
      newSalary: { type: Number },
      effectiveDate: { type: Date },
    },
    transferDetails: {
      oldBranchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
      newBranchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
      oldDepartment: { type: String },
      newDepartment: { type: String },
      effectiveDate: { type: Date },
    },
    resignationDetails: {
      resignationDate: { type: Date },
      lastWorkingDay: { type: Date },
      reason: { type: String },
      exitInterviewCompleted: { type: Boolean, default: false },
    },
    offboardingChecklist: {
      assetsReturned: { type: Boolean, default: false },
      itAccessRevoked: { type: Boolean, default: false },
      payrollSettled: { type: Boolean, default: false },
      clearanceCertificateIssued: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

employeeLifecycleSchema.plugin(softDeletePlugin);

export const EmployeeLifecycle = mongoose.model<IEmployeeLifecycle>('EmployeeLifecycle', employeeLifecycleSchema);
