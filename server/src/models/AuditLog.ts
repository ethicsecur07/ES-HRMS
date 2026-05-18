import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  performedBy: string;
  module: string;
  timestamp: Date;
  affectedRecord: string;
  details?: string;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    performedBy: { type: String, required: true },
    module: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    affectedRecord: { type: String, required: true },
    details: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
