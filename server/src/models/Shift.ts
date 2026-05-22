import mongoose, { Schema, Document } from 'mongoose';

export interface IShift extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // e.g. 'General Shift', 'Night Shift'
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  workingDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const shiftSchema = new Schema<IShift>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    workingDays: [{ type: Number, required: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shiftSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Shift = mongoose.model<IShift>('Shift', shiftSchema);
