import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganizationAuthConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  provider: 'LOCAL' | 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH';
  isEnabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationAuthConfigSchema = new Schema<IOrganizationAuthConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    provider: {
      type: String,
      enum: ['LOCAL', 'GOOGLE', 'MICROSOFT', 'SAML', 'OAUTH'],
      required: true,
    },
    isEnabled: { type: Boolean, default: true },
    clientId: { type: String },
    clientSecret: { type: String },
    redirectUri: { type: String },
    samlEntryPoint: { type: String },
    samlIssuer: { type: String },
    samlCert: { type: String },
  },
  { timestamps: true }
);

organizationAuthConfigSchema.index({ organizationId: 1, provider: 1 }, { unique: true });

export const OrganizationAuthConfig = mongoose.model<IOrganizationAuthConfig>(
  'OrganizationAuthConfig',
  organizationAuthConfigSchema
);
