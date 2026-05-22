import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionPolicy extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  isDefault: boolean;

  // Session limits
  maxConcurrentSessions: number;
  sessionTimeoutMinutes: number;
  idleTimeoutMinutes: number;
  forceReauthIntervalHours: number;

  // IP restrictions
  ipWhitelist: string[];
  ipBlacklist: string[];
  enforceIpRestriction: boolean;

  // Device restrictions
  requireTrustedDevice: boolean;
  maxDevicesPerUser: number;

  // MFA enforcement
  requireMFA: boolean;
  mfaGracePeriodDays: number;

  // Password policies
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  passwordExpiryDays: number;
  passwordHistoryCount: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const sessionPolicySchema = new Schema<ISessionPolicy>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    isDefault: { type: Boolean, default: false },

    maxConcurrentSessions: { type: Number, default: 5 },
    sessionTimeoutMinutes: { type: Number, default: 480 }, // 8 hours
    idleTimeoutMinutes: { type: Number, default: 30 },
    forceReauthIntervalHours: { type: Number, default: 24 },

    ipWhitelist: [{ type: String }],
    ipBlacklist: [{ type: String }],
    enforceIpRestriction: { type: Boolean, default: false },

    requireTrustedDevice: { type: Boolean, default: false },
    maxDevicesPerUser: { type: Number, default: 10 },

    requireMFA: { type: Boolean, default: false },
    mfaGracePeriodDays: { type: Number, default: 7 },

    passwordMinLength: { type: Number, default: 8 },
    passwordRequireUppercase: { type: Boolean, default: true },
    passwordRequireNumber: { type: Boolean, default: true },
    passwordRequireSpecial: { type: Boolean, default: true },
    passwordExpiryDays: { type: Number, default: 90 },
    passwordHistoryCount: { type: Number, default: 5 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

sessionPolicySchema.index({ organizationId: 1, isDefault: 1 });

export const SessionPolicy = mongoose.model<ISessionPolicy>('SessionPolicy', sessionPolicySchema);
