import mongoose, { Schema, Document } from 'mongoose';
import { DEPARTMENTS } from '../constants/index.js';

export interface IEmployee extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joiningDate: Date;
  profileImage?: string;
  salary: number;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  leaveBalance: number;
  wfhBalance: number;
  permissionHoursBalance: number;
  isActive: boolean;
  branchId?: mongoose.Types.ObjectId;
  costCenterId?: mongoose.Types.ObjectId;
  primaryManagerId?: mongoose.Types.ObjectId;
  designationId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  confirmationDate?: Date;
  terminationDate?: Date;
  customFields?: Map<string, any>;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    branchName: string;
  };
  taxDetails?: {
    panNumber: string;
    taxRegime: 'OLD' | 'NEW' | '';
  };
}

const employeeSchema = new Schema<IEmployee>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeCode: { type: String, required: false },
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    profileImage: { type: String },
    salary: { type: Number, required: true },
    address: { type: String, required: true },
    emergencyContact: {
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
    },
    leaveBalance: { type: Number, default: 2 },
    wfhBalance: { type: Number, default: 1 },
    permissionHoursBalance: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', index: true },
    costCenterId: { type: Schema.Types.ObjectId, ref: 'CostCenter', index: true },
    primaryManagerId: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    designationId: { type: Schema.Types.ObjectId, ref: 'Designation', index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    confirmationDate: { type: Date },
    terminationDate: { type: Date },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branchName: { type: String, default: '' },
    },
    taxDetails: {
      panNumber: { type: String, default: '' },
      taxRegime: { type: String, enum: ['OLD', 'NEW', ''], default: '' },
    },
  },
  { timestamps: true }
);

employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });

import { softDeletePlugin } from '../utils/softDeletePlugin.js';
import { User } from './User.js';

employeeSchema.plugin(softDeletePlugin);

// Cascade Soft Delete: When an Employee is soft-deleted, their User login is revoked
employeeSchema.pre('save', async function (next) {
  if (this.isModified('isDeleted') && (this as any).isDeleted === true) {
    const user = await User.findOne({ employeeId: this._id });
    if (user && typeof (user as any).softDelete === 'function') {
      await (user as any).softDelete();
    }
  }
  next();
});

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
