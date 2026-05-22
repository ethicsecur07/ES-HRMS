import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSession extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  rotatedTokenHashes: string[];
  deviceInfo?: string;
  ipAddress?: string;
  browser?: string;
  os?: string;
  location?: string;
  isRevoked: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSessionSchema = new Schema<IUserSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    refreshTokenHash: { type: String, required: true, index: true },
    rotatedTokenHashes: { type: [String], default: [] },
    deviceInfo: { type: String },
    ipAddress: { type: String },
    browser: { type: String },
    os: { type: String },
    location: { type: String },
    isRevoked: { type: Boolean, default: false },
    lastActivity: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index for auto-cleanup of sessions
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserSession = mongoose.model<IUserSession>('UserSession', userSessionSchema);
