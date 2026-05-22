import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

export interface IDocumentVersion {
  version: number;
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
}

const documentVersionSchema = new Schema<IDocumentVersion>({
  version: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

export interface IHRDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  name: string;
  category: 'CONTRACT' | 'PASSPORT' | 'VISA' | 'ID_PROOF' | 'CERTIFICATE' | 'OTHER';
  fileUrl: string;
  version: number;
  versions: IDocumentVersion[];
  expiresAt?: Date;
  signatureStatus: 'PENDING' | 'SIGNED' | 'NOT_REQUIRED';
  signedAt?: Date;
  signatureProviderId?: string; // ID from DocuSign/HelloSign etc.
  isActive: boolean;
}

const hrDocumentSchema = new Schema<IHRDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['CONTRACT', 'PASSPORT', 'VISA', 'ID_PROOF', 'CERTIFICATE', 'OTHER'],
      required: true,
      index: true
    },
    fileUrl: { type: String, required: true },
    version: { type: Number, default: 1 },
    versions: [documentVersionSchema],
    expiresAt: { type: Date, index: true },
    signatureStatus: {
      type: String,
      enum: ['PENDING', 'SIGNED', 'NOT_REQUIRED'],
      default: 'NOT_REQUIRED',
      index: true
    },
    signedAt: { type: Date },
    signatureProviderId: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

hrDocumentSchema.plugin(softDeletePlugin);

export const HRDocument = mongoose.model<IHRDocument>('HRDocument', hrDocumentSchema);
