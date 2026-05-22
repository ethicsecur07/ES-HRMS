import mongoose, { Schema, Document } from 'mongoose';

export interface IDepartment extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  headOfDepartment?: string;
  isActive: boolean;
}

const departmentSchema = new Schema<IDepartment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    headOfDepartment: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

import { softDeletePlugin } from '../utils/softDeletePlugin.js';

departmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });
departmentSchema.plugin(softDeletePlugin);

export const Department = mongoose.model<IDepartment>('Department', departmentSchema);
