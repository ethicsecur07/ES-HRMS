import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  recipientId: string; // user ID or 'all' for broadcast
  title: string;
  message: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  type: string; // e.g. TASK, LEAVE, ATTENDANCE, CHAT, APPROVAL
  templateId?: string; // optional reference to a template definition
  payload?: Record<string, any>; // provider‑specific data (e.g., email html)
  status: 'PENDING' | 'SENT' | 'FAILED';
  errorMessage?: string;
  expiresAt?: Date; // retention/cleanup
  read: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    recipientId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    channel: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'], required: true },
    type: { type: String, required: true, default: 'GENERAL' },
    templateId: { type: String },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'PENDING' },
    errorMessage: { type: String },
    expiresAt: { type: Date },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, recipientId: 1, status: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
