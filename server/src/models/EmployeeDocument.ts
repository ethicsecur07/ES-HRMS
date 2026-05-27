import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeDocument extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  name: string;
  category: 'RESUME' | 'OFFER_LETTER' | 'CERTIFICATE' | 'TAX_DOCUMENT' | 'PAYSLIP' | 'ASSET' | 'OTHER';
  fileUrl: string;
  uploadedAt: Date;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['RESUME', 'OFFER_LETTER', 'CERTIFICATE', 'TAX_DOCUMENT', 'PAYSLIP', 'ASSET', 'OTHER'],
      required: true,
      index: true
    },
    fileUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const EmployeeDocument = mongoose.model<IEmployeeDocument>('EmployeeDocument', employeeDocumentSchema);
