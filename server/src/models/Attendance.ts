import mongoose, { Schema, Document } from 'mongoose';
import { ATTENDANCE_TYPES } from '../constants/index.js';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

export interface IBreak {
  breakStart: Date;
  breakEnd?: Date;
  durationMinutes?: number;
  type?: 'LUNCH' | 'TEA' | 'PERSONAL';
}

export interface IAttendance extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  loginTime: Date;
  logoutTime?: Date;
  ipAddress: string;
  deviceInfo: string;
  status: string;
  workingHours?: number;
  isLate: boolean;
  taskSubmitted: boolean;
  locationVerified: boolean;
  overrideReason?: string;
  isAutoCheckedOut?: boolean;
  pendingReportUpdate?: boolean;
  
  // Advanced Attendance Features
  biometricId?: string;
  deviceId?: string;
  geoFence?: {
    latitude: number;
    longitude: number;
    withinGeoFence: boolean;
    distanceFromCenter: number; // in meters
  };
  faceVerification?: {
    verified: boolean;
    confidence: number;
    faceImage?: string;
  };
  breaks: IBreak[];
  overtime?: {
    hours: number;
    isApproved: boolean;
    approvedBy?: mongoose.Types.ObjectId;
  };
  shiftId?: mongoose.Types.ObjectId;
  anomaly?: {
    isAnomaly: boolean;
    anomalyType?: 'GEO_BREACH' | 'MISSING_OUT' | 'UNUSUAL_HOURS' | 'BREAK_EXCESS';
    description?: string;
    isResolved: boolean;
    resolvedBy?: mongoose.Types.ObjectId;
  };
  editHistory?: {
    field: string;
    oldValue: string;
    newValue: string;
    updatedBy: string;
    time: Date;
    ip: string;
  }[];
}

const breakSchema = new Schema<IBreak>({
  breakStart: { type: Date, required: true },
  breakEnd: { type: Date },
  durationMinutes: { type: Number, default: 0 },
  type: { type: String, enum: ['LUNCH', 'TEA', 'PERSONAL'], default: 'LUNCH' }
});

const attendanceSchema = new Schema<IAttendance>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, index: true },
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date },
    ipAddress: { type: String, required: true },
    deviceInfo: { type: String, required: true },
    status: { type: String, enum: Object.values(ATTENDANCE_TYPES), default: ATTENDANCE_TYPES.OFFICE },
    workingHours: { type: Number },
    isLate: { type: Boolean, default: false },
    taskSubmitted: { type: Boolean, default: false },
    locationVerified: { type: Boolean, default: true },
    overrideReason: { type: String },
    isAutoCheckedOut: { type: Boolean, default: false },
    pendingReportUpdate: { type: Boolean, default: false },

    // Advanced Attendance Engine
    biometricId: { type: String },
    deviceId: { type: String },
    geoFence: {
      latitude: { type: Number },
      longitude: { type: Number },
      withinGeoFence: { type: Boolean, default: true },
      distanceFromCenter: { type: Number, default: 0 }
    },
    faceVerification: {
      verified: { type: Boolean, default: false },
      confidence: { type: Number, default: 0 },
      faceImage: { type: String }
    },
    breaks: [breakSchema],
    overtime: {
      hours: { type: Number, default: 0 },
      isApproved: { type: Boolean, default: false },
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
    anomaly: {
      isAnomaly: { type: Boolean, default: false, index: true },
      anomalyType: { type: String, enum: ['GEO_BREACH', 'MISSING_OUT', 'UNUSUAL_HOURS', 'BREAK_EXCESS'] },
      description: { type: String },
      isResolved: { type: Boolean, default: false },
      resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    editHistory: [
      {
        field: { type: String, required: true },
        oldValue: { type: String, required: true },
        newValue: { type: String, required: true },
        updatedBy: { type: String, required: true },
        time: { type: Date, default: Date.now },
        ip: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

// Prevent duplicate attendance per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.plugin(softDeletePlugin);

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);

