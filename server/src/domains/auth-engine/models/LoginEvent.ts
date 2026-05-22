import mongoose, { Schema, Document } from 'mongoose';

export type LoginStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED' | 'MFA_REQUIRED' | 'MFA_FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ILoginEvent extends Document {
  userId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  email: string;
  status: LoginStatus;
  provider: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  location?: string;
  riskLevel: RiskLevel;
  riskFactors: string[];
  failureReason?: string;
  sessionId?: string;
  mfaMethod?: string;
  createdAt: Date;
}

const loginEventSchema = new Schema<ILoginEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    email: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'BLOCKED', 'MFA_REQUIRED', 'MFA_FAILED'],
      required: true,
    },
    provider: { type: String, default: 'LOCAL' },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    deviceFingerprint: { type: String },
    location: { type: String },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    riskFactors: [{ type: String }],
    failureReason: { type: String },
    sessionId: { type: String },
    mfaMethod: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginEventSchema.index({ email: 1, createdAt: -1 });
loginEventSchema.index({ organizationId: 1, createdAt: -1 });
loginEventSchema.index({ ipAddress: 1, createdAt: -1 });
// TTL index: auto-delete login events older than 90 days
loginEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const LoginEvent = mongoose.model<ILoginEvent>('LoginEvent', loginEventSchema);
