import mongoose, { Schema, Document } from 'mongoose';

export interface IRoleMember extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roleMemberSchema = new Schema<IRoleMember>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true, index: true },
  },
  { timestamps: true }
);

roleMemberSchema.index({ organizationId: 1, userId: 1, roleId: 1 }, { unique: true });

export const RoleMember = mongoose.model<IRoleMember>('RoleMember', roleMemberSchema);
