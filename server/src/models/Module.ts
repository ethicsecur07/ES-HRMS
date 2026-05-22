import mongoose, { Schema, Document } from 'mongoose';

export interface IModule extends Document {
  name: string;
  code: string; // e.g., 'PAYROLL', 'ERP', 'PROJECTS', 'ASSETS', 'FINANCE'
  version: string;
  dependencies: string[]; // Codes of required modules
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<IModule>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    version: { type: String, default: '1.0.0' },
    dependencies: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Module = mongoose.model<IModule>('Module', moduleSchema);
