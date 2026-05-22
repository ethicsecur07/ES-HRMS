import { Schema, Document, Query } from 'mongoose';

export interface SoftDeleteDocument extends Document {
  isDeleted: boolean;
  deletedAt?: Date | null;
  softDelete(): Promise<this>;
  restore(): Promise<this>;
}

export function softDeletePlugin(schema: Schema) {
  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null }
  });

  // Filter out soft deleted documents on common read queries
  const activeQueries = ['find', 'findOne', 'findOneAndUpdate', 'updateMany', 'updateOne', 'countDocuments'];
  
  activeQueries.forEach(type => {
    schema.pre(type as any, function (this: Query<any, any>, next) {
      const filter = this.getFilter();
      if (filter.isDeleted === undefined) {
        this.where({ isDeleted: { $ne: true } });
      }
      next();
    });
  });

  // Custom softDelete method
  schema.methods.softDelete = async function (this: SoftDeleteDocument) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
  };

  // Custom restore method
  schema.methods.restore = async function (this: SoftDeleteDocument) {
    this.isDeleted = false;
    this.deletedAt = null;
    return this.save();
  };
}
