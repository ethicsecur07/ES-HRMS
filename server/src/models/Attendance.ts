import mongoose, { Schema, Document } from 'mongoose';
import { ATTENDANCE_TYPES } from '../constants/index.js';

export interface IAttendance extends Document {
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
}

const attendanceSchema = new Schema<IAttendance>(
  {
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
  },
  { timestamps: true }
);

// Prevent duplicate attendance per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);
