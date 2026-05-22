import mongoose, { Schema, Document } from 'mongoose';

export type ProviderType =
  | 'LOCAL'
  | 'GOOGLE'
  | 'MICROSOFT'
  | 'AZURE_AD'
  | 'OKTA'
  | 'AUTH0'
  | 'ONELOGIN'
  | 'SAML2';

export interface IIdentityProvider extends Document {
  organizationId: mongoose.Types.ObjectId;
  providerType: ProviderType;
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
  domain?: string; // Okta domain, Auth0 domain
  apiKey?: string; // OneLogin API key

  // Attribute mapping for SSO claims
  attributeMapping: {
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

const identityProviderSchema = new Schema<IIdentityProvider>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    providerType: {
      type: String,
      enum: ['LOCAL', 'GOOGLE', 'MICROSOFT', 'AZURE_AD', 'OKTA', 'AUTH0', 'ONELOGIN', 'SAML2'],
      required: true,
    },
    displayName: { type: String, required: true },
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
    apiKey: { type: String },

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
    defaultRoleCode: { type: String },
  },
  { timestamps: true }
);

import { encrypt, decrypt } from '../../../utils/crypto.js';

identityProviderSchema.pre('save', function (next) {
  if (this.isModified('clientSecret') && this.clientSecret) {
    this.clientSecret = encrypt(this.clientSecret);
  }
  if (this.isModified('apiKey') && this.apiKey) {
    this.apiKey = encrypt(this.apiKey);
  }
  next();
});

identityProviderSchema.post('init', function (doc) {
  if (doc.clientSecret) {
    doc.clientSecret = decrypt(doc.clientSecret);
  }
  if (doc.apiKey) {
    doc.apiKey = decrypt(doc.apiKey);
  }
});

identityProviderSchema.index({ organizationId: 1, providerType: 1 }, { unique: true });
identityProviderSchema.index({ organizationId: 1, isPrimary: 1 });

export const IdentityProvider = mongoose.model<IIdentityProvider>(
  'IdentityProvider',
  identityProviderSchema
);
