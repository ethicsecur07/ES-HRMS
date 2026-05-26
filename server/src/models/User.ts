import mongoose, { Schema, Document } from 'mongoose';
import { ROLES } from '../constants/index.js';

export interface IUser extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  profileImage?: string;
  role: keyof typeof ROLES;
  employeeId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  mfaEnabled: boolean;
  mfaSecret?: string;
  backupCodes?: string[];
  isBlocked: boolean;
  blockedUntil?: Date;
  passwordChangedAt: Date;
  ssoData?: {
    provider: string;
    azureRoles: string[];
    mappedRole?: string;
    lastSyncedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    profileImage: { type: String },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.EMPLOYEE },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    backupCodes: { type: [String], select: false },
    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date },
    passwordChangedAt: { type: Date, default: Date.now },
    ssoData: {
      provider: { type: String },
      azureRoles: { type: [String] },
      mappedRole: { type: String },
      lastSyncedAt: { type: Date }
    },
  },
  { timestamps: true }
);

import { softDeletePlugin } from '../utils/softDeletePlugin.js';

// Enforce tenant isolation for users (an email can only exist once PER organization)
userSchema.index({ email: 1, organizationId: 1 }, { unique: true });
userSchema.plugin(softDeletePlugin);

export const User = mongoose.model<IUser>('User', userSchema);
