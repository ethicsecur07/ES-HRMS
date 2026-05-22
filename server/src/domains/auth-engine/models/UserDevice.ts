import mongoose, { Schema, Document } from 'mongoose';

export type DeviceStatus = 'TRUSTED' | 'UNTRUSTED' | 'BLOCKED';

export interface IUserDevice extends Document {
  userId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  fingerprint: string; // unique device hash
  deviceName: string;
  deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET' | 'UNKNOWN';
  browser?: string;
  os?: string;
  ipAddress: string;
  location?: string;
  status: DeviceStatus;
  isCurrent: boolean;
  lastUsedAt: Date;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userDeviceSchema = new Schema<IUserDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    fingerprint: { type: String, required: true },
    deviceName: { type: String, required: true },
    deviceType: { type: String, enum: ['DESKTOP', 'MOBILE', 'TABLET', 'UNKNOWN'], default: 'UNKNOWN' },
    browser: { type: String },
    os: { type: String },
    ipAddress: { type: String, required: true },
    location: { type: String },
    status: { type: String, enum: ['TRUSTED', 'UNTRUSTED', 'BLOCKED'], default: 'UNTRUSTED' },
    isCurrent: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    firstSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
userDeviceSchema.index({ organizationId: 1, status: 1 });

export const UserDevice = mongoose.model<IUserDevice>('UserDevice', userDeviceSchema);
