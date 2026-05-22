import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

// --- BIOMETRIC DEVICE MODEL ---
export interface IBiometricDevice extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  ipAddress: string;
  port: number;
  secretKey?: string;
  status: 'ONLINE' | 'OFFLINE';
  isActive: boolean;
  lastPingAt?: Date;
}

const biometricDeviceSchema = new Schema<IBiometricDevice>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    ipAddress: { type: String, required: true },
    port: { type: Number, required: true, default: 4370 },
    secretKey: { type: String },
    status: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    isActive: { type: Boolean, default: true },
    lastPingAt: { type: Date },
  },
  { timestamps: true }
);
biometricDeviceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
biometricDeviceSchema.plugin(softDeletePlugin);

export const BiometricDevice = mongoose.model<IBiometricDevice>('BiometricDevice', biometricDeviceSchema);

// --- GEOFENCE MODEL ---
export interface IGeoFence extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  isActive: boolean;
}

const geoFenceSchema = new Schema<IGeoFence>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, required: true, default: 100 }, // default 100 meters
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
geoFenceSchema.index({ organizationId: 1, name: 1 }, { unique: true });
geoFenceSchema.plugin(softDeletePlugin);

export const GeoFence = mongoose.model<IGeoFence>('GeoFence', geoFenceSchema);

// --- SHIFT ROTATION MODEL ---
export interface IShiftRotation extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  shifts: mongoose.Types.ObjectId[]; // Order of shifts in rotation
  rotationCycleWeeks: number; // Duration of each cycle in weeks
  startDate: Date;
  isActive: boolean;
}

const shiftRotationSchema = new Schema<IShiftRotation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    shifts: [{ type: Schema.Types.ObjectId, ref: 'Shift', required: true }],
    rotationCycleWeeks: { type: Number, required: true, default: 1 },
    startDate: { type: Date, required: true, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
shiftRotationSchema.plugin(softDeletePlugin);

export const ShiftRotation = mongoose.model<IShiftRotation>('ShiftRotation', shiftRotationSchema);
