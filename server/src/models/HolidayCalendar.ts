import mongoose, { Schema, Document } from 'mongoose';

export interface IHolidayCalendar extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // e.g. 'New Year', 'Christmas'
  date: string; // YYYY-MM-DD
  isRestricted: boolean; // restricted holiday
  createdAt: Date;
  updatedAt: Date;
}

const holidayCalendarSchema = new Schema<IHolidayCalendar>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    date: { type: String, required: true },
    isRestricted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

holidayCalendarSchema.index({ organizationId: 1, date: 1 }, { unique: true });

export const HolidayCalendar = mongoose.model<IHolidayCalendar>('HolidayCalendar', holidayCalendarSchema);
