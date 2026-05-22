import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string; // e.g. 'MacBook Pro M3', 'Dell Monitor 27'
  serialNumber: string;
  type: 'HARDWARE' | 'SOFTWARE' | 'FURNITURE' | 'OTHER';
  assignedTo?: mongoose.Types.ObjectId; // Employee reference
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'DISPOSED';
  purchaseDate?: string;
  cost?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    serialNumber: { type: String, required: true },
    type: { type: String, enum: ['HARDWARE', 'SOFTWARE', 'FURNITURE', 'OTHER'], default: 'HARDWARE' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Employee' },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DISPOSED'],
      default: 'AVAILABLE',
      index: true,
    },
    purchaseDate: { type: String },
    cost: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

assetSchema.index({ organizationId: 1, serialNumber: 1 }, { unique: true });

export const Asset = mongoose.model<IAsset>('Asset', assetSchema);
