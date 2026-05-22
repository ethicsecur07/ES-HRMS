import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganizationModule extends Document {
  organizationId: mongoose.Types.ObjectId;
  moduleCode: string;
  isEnabled: boolean;
  featureFlags: Map<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const organizationModuleSchema = new Schema<IOrganizationModule>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    moduleCode: { type: String, required: true, uppercase: true, trim: true },
    isEnabled: { type: Boolean, default: true },
    featureFlags: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true }
);

organizationModuleSchema.index({ organizationId: 1, moduleCode: 1 }, { unique: true });

export const OrganizationModule = mongoose.model<IOrganizationModule>('OrganizationModule', organizationModuleSchema);
