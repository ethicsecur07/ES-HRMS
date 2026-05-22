import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // e.g., 'Team Lead', 'Senior HR', 'Floor Manager'
  code: string; // e.g., 'TEAM_LEAD', 'SENIOR_HR'
  slug: string;
  description?: string;
  parentRoleId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String },
    parentRoleId: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roleSchema.pre('validate', function (next) {
  if (!this.slug) {
    this.slug = (this.code || this.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

roleSchema.index({ organizationId: 1, code: 1 }, { unique: true });
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });
roleSchema.index({ slug: 1, organizationId: 1 }, { unique: true });

export const Role = mongoose.model<IRole>('Role', roleSchema);
