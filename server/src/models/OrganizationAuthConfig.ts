import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

export type ProviderType = 'LOCAL' | 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH';

export interface IOrganizationAuthConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  provider: ProviderType;
  displayName: string;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: number; // lower = higher priority

  // OAuth2 fields
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];

  // SAML fields
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
  samlCallbackUrl?: string;
  samlSignatureAlgorithm?: string;

  // Provider-specific metadata
  tenantId?: string; // Azure AD tenant
  domain?: string;   // Custom domains

  // Attribute mapping for SSO claims
  attributeMapping?: {
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    department?: string;
  };

  // Auto-provisioning config
  autoProvision: boolean;
  defaultRoleCode?: string;

  createdAt: Date;
  updatedAt: Date;
}

const organizationAuthConfigSchema = new Schema<IOrganizationAuthConfig>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['LOCAL', 'GOOGLE', 'MICROSOFT', 'SAML', 'OAUTH'],
      required: true,
    },
    displayName: { type: String, default: 'Authentication Provider' },
    isEnabled: { type: Boolean, default: true },
    isPrimary: { type: Boolean, default: false },
    priority: { type: Number, default: 0 },

    // OAuth2
    clientId: { type: String },
    clientSecret: { type: String },
    redirectUri: { type: String },
    authorizationUrl: { type: String },
    tokenUrl: { type: String },
    userInfoUrl: { type: String },
    scopes: [{ type: String }],

    // SAML
    samlEntryPoint: { type: String },
    samlIssuer: { type: String },
    samlCert: { type: String },
    samlCallbackUrl: { type: String },
    samlSignatureAlgorithm: { type: String, default: 'sha256' },

    // Provider-specific
    tenantId: { type: String },
    domain: { type: String },

    // Attribute mapping
    attributeMapping: {
      email: { type: String, default: 'email' },
      name: { type: String, default: 'name' },
      firstName: { type: String },
      lastName: { type: String },
      groups: { type: String },
      department: { type: String },
    },

    // Auto-provisioning
    autoProvision: { type: Boolean, default: false },
    defaultRoleCode: { type: String, default: 'EMPLOYEE' },
  },
  {
    timestamps: true,
    collection: 'organization_auth_configs',
  }
);

// Encrypt secret on save
organizationAuthConfigSchema.pre('save', function (next) {
  if (this.isModified('clientSecret') && this.clientSecret) {
    this.clientSecret = encrypt(this.clientSecret);
  }
  next();
});

// Decrypt secret on init/load
organizationAuthConfigSchema.post('init', function (doc) {
  if (doc.clientSecret) {
    doc.clientSecret = decrypt(doc.clientSecret);
  }
});

organizationAuthConfigSchema.index({ organizationId: 1, provider: 1 }, { unique: true });
organizationAuthConfigSchema.index({ organizationId: 1, isPrimary: 1 });

export const OrganizationAuthConfig = mongoose.model<IOrganizationAuthConfig>(
  'OrganizationAuthConfig',
  organizationAuthConfigSchema
);
