import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  type: 'ANNOUNCEMENT' | 'POLICY_CHANGE';
  createdBy: mongoose.Types.ObjectId; // User ID
  createdByName: string;
  createdByRole: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['ANNOUNCEMENT', 'POLICY_CHANGE'],
      default: 'ANNOUNCEMENT',
      required: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, required: true },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ organizationId: 1, createdAt: -1 });

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
