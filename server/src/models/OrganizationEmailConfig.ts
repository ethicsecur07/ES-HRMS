import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/crypto.js';

export interface IOrganizationEmailConfig extends Document {
  organizationId: mongoose.Types.ObjectId;
  provider: 'GMAIL' | 'OUTLOOK' | 'CUSTOM';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizationEmailConfigSchema = new Schema<IOrganizationEmailConfig>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    provider: {
      type: String,
      enum: ['GMAIL', 'OUTLOOK', 'CUSTOM'],
      required: true,
      default: 'CUSTOM',
    },
    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPassword: { 
      type: String,
      set: (val: string) => {
        if (!val) return val;
        // Check if it's already encrypted to avoid double encryption
        if (val.includes(':') && val.split(':').length === 3) return val;
        return encrypt(val);
      },
      get: (val: string) => {
        if (!val) return val;
        return decrypt(val);
      }
    },
    fromEmail: { type: String },
    fromName: { type: String },
  },
  { 
    timestamps: true,
    toJSON: { getters: true }, // Ensure getters run on toJSON
    toObject: { getters: true }
  }
);

organizationEmailConfigSchema.index({ organizationId: 1 }, { unique: true });

export const OrganizationEmailConfig = mongoose.model<IOrganizationEmailConfig>(
  'OrganizationEmailConfig',
  organizationEmailConfigSchema
);
