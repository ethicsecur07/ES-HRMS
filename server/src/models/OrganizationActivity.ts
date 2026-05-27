import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganizationActivity extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  actorName: string;
  actionType: string;
  description: string;
  referenceId?: mongoose.Types.ObjectId;
  referenceModel?: string;
  createdAt: Date;
}

const organizationActivitySchema = new Schema<IOrganizationActivity>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorName: { type: String, required: true },
    actionType: { type: String, required: true, index: true },
    description: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: { type: String }
  },
  { timestamps: true }
);

export const OrganizationActivity = mongoose.model<IOrganizationActivity>('OrganizationActivity', organizationActivitySchema);
