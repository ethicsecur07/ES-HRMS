import mongoose, { Schema, Document } from 'mongoose';

export type MFAMethod = 'TOTP' | 'SMS' | 'EMAIL';

export interface IMFAConfig extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  isEnabled: boolean;
  methods: MFAMethod[];
  primaryMethod: MFAMethod;

  // TOTP
  totpSecret?: string;
  totpVerified: boolean;

  // SMS
  phoneNumber?: string;
  phoneVerified: boolean;

  // Email
  emailVerified: boolean;

  // Recovery
  recoveryCodes: string[];
  recoveryCodesUsed: string[];

  lastVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mfaConfigSchema = new Schema<IMFAConfig>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    isEnabled: { type: Boolean, default: false },
    methods: [{ type: String, enum: ['TOTP', 'SMS', 'EMAIL'] }],
    primaryMethod: { type: String, enum: ['TOTP', 'SMS', 'EMAIL'], default: 'TOTP' },

    totpSecret: { type: String, select: false },
    totpVerified: { type: Boolean, default: false },

    phoneNumber: { type: String },
    phoneVerified: { type: Boolean, default: false },

    emailVerified: { type: Boolean, default: false },

    recoveryCodes: [{ type: String, select: false }],
    recoveryCodesUsed: [{ type: String }],

    lastVerifiedAt: { type: Date },
  },
  { timestamps: true }
);

mfaConfigSchema.index({ userId: 1, organizationId: 1 }, { unique: true });

export const MFAConfig = mongoose.model<IMFAConfig>('MFAConfig', mfaConfigSchema);
