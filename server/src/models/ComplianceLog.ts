import mongoose, { Schema, Document } from 'mongoose';

export interface IComplianceLog extends Document {
  organizationId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  username?: string;
  ipAddress: string;
  eventType: 'ACCESS_VIOLATION' | 'UNAUTHORIZED_IP_LOGIN' | 'PRIVILEGE_ESCALATION' | 'SUSPICIOUS_ACTIVITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: Schema.Types.Mixed;
  userAgent?: string;
  createdAt: Date;
}

const complianceLogSchema = new Schema<IComplianceLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    username: { type: String },
    ipAddress: { type: String, required: true, index: true },
    eventType: {
      type: String,
      enum: ['ACCESS_VIOLATION', 'UNAUTHORIZED_IP_LOGIN', 'PRIVILEGE_ESCALATION', 'SUSPICIOUS_ACTIVITY'],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
      index: true
    },
    details: { type: Schema.Types.Mixed, required: true },
    userAgent: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ComplianceLog = mongoose.model<IComplianceLog>('ComplianceLog', complianceLogSchema);
