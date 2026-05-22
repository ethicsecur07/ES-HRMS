import mongoose, { Schema, Document } from 'mongoose';

export interface IDesignation extends Document {
  organizationId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  name: string; // e.g., 'Senior Developer', 'HR Associate'
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const designationSchema = new Schema<IDesignation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

designationSchema.index({ organizationId: 1, departmentId: 1, name: 1 }, { unique: true });

import { softDeletePlugin } from '../utils/softDeletePlugin.js';
designationSchema.plugin(softDeletePlugin);

export const Designation = mongoose.model<IDesignation>('Designation', designationSchema);
