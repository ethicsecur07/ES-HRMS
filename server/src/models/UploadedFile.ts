import mongoose, { Schema, Document } from 'mongoose';

export interface IUploadedFile extends Document {
  organizationId: mongoose.Types.ObjectId;
  fileName: string;
  fileId: string;
  url: string;
  uploadedAt: Date;
  mimeType: string;
  size: number;
}

const uploadedFileSchema = new Schema<IUploadedFile>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  fileName: { type: String, required: true },
  fileId: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
});

export const UploadedFile = mongoose.model<IUploadedFile>('UploadedFile', uploadedFileSchema);
