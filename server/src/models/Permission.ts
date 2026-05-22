import mongoose, { Schema, Document } from 'mongoose';

export interface IPermission extends Document {
  organizationId: mongoose.Types.ObjectId;
  roleId?: mongoose.Types.ObjectId; // if assigned role-wise
  userId?: mongoose.Types.ObjectId; // if assigned user-wise (override)
  module: string; // e.g., 'EMPLOYEES', 'PAYROLL', 'FINANCE', 'LEAVES', 'PROJECTS', 'SETTINGS'
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    assign: boolean;
    export: boolean;
  };
  restrictedFields: string[]; // Fields that are restricted for this permission (field-level security)
  policyCondition?: any; // Structured JSON policy e.g. [{ attribute: "resource.ownerId", operator: "EQUALS", value: "user.id" }]
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    module: { type: String, required: true, index: true },
    actions: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      approve: { type: Boolean, default: false },
      assign: { type: Boolean, default: false },
      export: { type: Boolean, default: false },
    },
    restrictedFields: { type: [String], default: [] },
    policyCondition: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Either roleId or userId must be present
permissionSchema.index({ organizationId: 1, roleId: 1, userId: 1, module: 1 }, { unique: true });

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);

