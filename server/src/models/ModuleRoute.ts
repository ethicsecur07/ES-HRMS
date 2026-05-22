import mongoose, { Schema, Document } from 'mongoose';

export interface IModuleRoute extends Document {
  moduleCode: string; // reference to Module.code
  routePath: string; // frontend path, e.g., '/payroll'
  displayName: string; // name shown in UI navigation
  order?: number; // optional ordering weight
  createdAt: Date;
  updatedAt: Date;
}

const moduleRouteSchema = new Schema<IModuleRoute>(
  {
    moduleCode: { type: String, required: true, uppercase: true, trim: true },
    routePath: { type: String, required: true },
    displayName: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Ensure each module has unique route definitions
moduleRouteSchema.index({ moduleCode: 1, routePath: 1 }, { unique: true });

export const ModuleRoute = mongoose.model<IModuleRoute>('ModuleRoute', moduleRouteSchema);
