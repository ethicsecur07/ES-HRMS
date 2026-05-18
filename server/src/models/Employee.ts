import mongoose, { Schema, Document } from 'mongoose';
import { DEPARTMENTS } from '../constants/index.js';

export interface IEmployee extends Document {
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joiningDate: Date;
  profileImage?: string;
  salary: number;
  address: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  leaveBalance: number;
  wfhBalance: number;
  permissionHoursBalance: number;
  isActive: boolean;
}

const employeeSchema = new Schema<IEmployee>(
  {
    employeeCode: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    department: { type: String, enum: Object.values(DEPARTMENTS), required: true },
    designation: { type: String, required: true },
    joiningDate: { type: Date, required: true },
    profileImage: { type: String },
    salary: { type: Number, required: true },
    address: { type: String, required: true },
    emergencyContact: {
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
    },
    leaveBalance: { type: Number, default: 2 },
    wfhBalance: { type: Number, default: 1 },
    permissionHoursBalance: { type: Number, default: 3 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
