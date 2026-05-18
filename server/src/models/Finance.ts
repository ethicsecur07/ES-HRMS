import mongoose, { Schema, Document } from 'mongoose';

export interface IFinance extends Document {
  type: 'ALLOCATION' | 'EXPENSE';
  amount: number;
  categoryOrReason: string;
  description?: string;
  date: string; // YYYY-MM-DD
  loggedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const financeSchema = new Schema<IFinance>(
  {
    type: { type: String, enum: ['ALLOCATION', 'EXPENSE'], required: true },
    amount: { type: Number, required: true },
    categoryOrReason: { type: String, required: true },
    description: { type: String },
    date: { type: String, required: true, index: true },
    loggedBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const Finance = mongoose.model<IFinance>('Finance', financeSchema);
