import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxSlab extends Document {
  organizationId: mongoose.Types.ObjectId;
  country: string; // e.g., 'IN', 'US'
  regime?: string; // e.g., 'OLD', 'NEW' for India
  minIncome: number;
  maxIncome: number;
  taxRatePercentage: number;
  flatTaxAmount: number; // Flat tax for hitting this bracket
  effectiveYear: number;
}

const taxSlabSchema = new Schema<ITaxSlab>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    country: { type: String, required: true },
    regime: { type: String },
    minIncome: { type: Number, required: true },
    maxIncome: { type: Number, required: true },
    taxRatePercentage: { type: Number, required: true },
    flatTaxAmount: { type: Number, default: 0 },
    effectiveYear: { type: Number, required: true }
  },
  { timestamps: true }
);

export const TaxSlab = mongoose.model<ITaxSlab>('TaxSlab', taxSlabSchema);
