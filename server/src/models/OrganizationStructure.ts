import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

// --- BRANCH MODEL ---
export interface IBranch extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  timezone?: string;
  isActive: boolean;
}

const branchSchema = new Schema<IBranch>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    address: { type: String },
    timezone: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
branchSchema.index({ organizationId: 1, code: 1 }, { unique: true });
branchSchema.plugin(softDeletePlugin);

export const Branch = mongoose.model<IBranch>('Branch', branchSchema);

// --- DIVISION MODEL ---
export interface IDivision extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  branchId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const divisionSchema = new Schema<IDivision>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
divisionSchema.index({ organizationId: 1, code: 1 }, { unique: true });
divisionSchema.plugin(softDeletePlugin);

export const Division = mongoose.model<IDivision>('Division', divisionSchema);

// --- BUSINESS UNIT MODEL ---
export interface IBusinessUnit extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  divisionId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const businessUnitSchema = new Schema<IBusinessUnit>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    divisionId: { type: Schema.Types.ObjectId, ref: 'Division' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
businessUnitSchema.index({ organizationId: 1, code: 1 }, { unique: true });
businessUnitSchema.plugin(softDeletePlugin);

export const BusinessUnit = mongoose.model<IBusinessUnit>('BusinessUnit', businessUnitSchema);

// --- COST CENTER MODEL ---
export interface ICostCenter extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

const costCenterSchema = new Schema<ICostCenter>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
costCenterSchema.index({ organizationId: 1, code: 1 }, { unique: true });
costCenterSchema.plugin(softDeletePlugin);

export const CostCenter = mongoose.model<ICostCenter>('CostCenter', costCenterSchema);

// --- REPORTING HIERARCHY / MATRIX HIERARCHY MODEL ---
export interface IReportingHierarchy extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  primaryManagerId?: mongoose.Types.ObjectId; // Direct/line manager
  matrixManagers: mongoose.Types.ObjectId[]; // Matrix/dotted-line managers
  hrBPId?: mongoose.Types.ObjectId; // HR Business Partner
  createdAt: Date;
  updatedAt: Date;
}

const reportingHierarchySchema = new Schema<IReportingHierarchy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    primaryManagerId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    matrixManagers: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    hrBPId: { type: Schema.Types.ObjectId, ref: 'Employee' },
  },
  { timestamps: true }
);
reportingHierarchySchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
reportingHierarchySchema.plugin(softDeletePlugin);

export const ReportingHierarchy = mongoose.model<IReportingHierarchy>('ReportingHierarchy', reportingHierarchySchema);
