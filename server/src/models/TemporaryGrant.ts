import mongoose, { Schema, Document } from 'mongoose';

export interface ITemporaryGrant extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // User receiving temporary access
  delegatedBy: mongoose.Types.ObjectId; // User delegating their access
  roleId?: mongoose.Types.ObjectId; // Optional role to grant
  module: string; // Module code
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    assign: boolean;
    export: boolean;
  };
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const temporaryGrantSchema = new Schema<ITemporaryGrant>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    delegatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
    module: { type: String, required: true },
    actions: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      assign: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
    },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const TemporaryGrant = mongoose.model<ITemporaryGrant>('TemporaryGrant', temporaryGrantSchema);
