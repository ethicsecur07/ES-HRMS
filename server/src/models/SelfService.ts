import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

// --- REIMBURSEMENT CLAIM MODEL ---
export interface IReimbursementClaim extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  expenseDate: Date;
  amount: number;
  category: 'TRAVEL' | 'MEDICAL' | 'FOOD' | 'EQUIPMENT' | 'OTHER';
  description: string;
  receiptUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

const reimbursementClaimSchema = new Schema<IReimbursementClaim>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    expenseDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    category: {
      type: String,
      enum: ['TRAVEL', 'MEDICAL', 'FOOD', 'EQUIPMENT', 'OTHER'],
      required: true,
    },
    description: { type: String, required: true },
    receiptUrl: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);
reimbursementClaimSchema.plugin(softDeletePlugin);

export const ReimbursementClaim = mongoose.model<IReimbursementClaim>('ReimbursementClaim', reimbursementClaimSchema);

// --- TAX DECLARATION MODEL ---
export interface ITaxDeclaration extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  financialYear: string; // e.g. "2025-2026"
  declarationSection: '80C' | '80D' | 'HRA' | 'SECTION_24' | 'OTHER';
  declaredAmount: number;
  proofUrl?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

const taxDeclarationSchema = new Schema<ITaxDeclaration>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    financialYear: { type: String, required: true, index: true },
    declarationSection: {
      type: String,
      enum: ['80C', '80D', 'HRA', 'SECTION_24', 'OTHER'],
      required: true,
    },
    declaredAmount: { type: Number, required: true },
    proofUrl: { type: String },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);
taxDeclarationSchema.plugin(softDeletePlugin);

export const TaxDeclaration = mongoose.model<ITaxDeclaration>('TaxDeclaration', taxDeclarationSchema);

// --- ATTENDANCE CORRECTION REQUEST MODEL ---
export interface IAttendanceCorrectionRequest extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  attendanceDate: string; // YYYY-MM-DD
  requestedLoginTime: Date;
  requestedLogoutTime: Date;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

const attendanceCorrectionRequestSchema = new Schema<IAttendanceCorrectionRequest>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    attendanceDate: { type: String, required: true, index: true },
    requestedLoginTime: { type: Date, required: true },
    requestedLogoutTime: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
  },
  { timestamps: true }
);
attendanceCorrectionRequestSchema.plugin(softDeletePlugin);

export const AttendanceCorrectionRequest = mongoose.model<IAttendanceCorrectionRequest>(
  'AttendanceCorrectionRequest',
  attendanceCorrectionRequestSchema
);
