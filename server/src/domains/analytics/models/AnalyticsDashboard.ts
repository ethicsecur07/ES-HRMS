import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsDashboard extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  layout: any; // JSON layout definition
  widgets: mongoose.Types.ObjectId[]; // references to KPIWidget
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsDashboardSchema = new Schema<IAnalyticsDashboard>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    layout: { type: Schema.Types.Mixed, required: true },
    widgets: [{ type: Schema.Types.ObjectId, ref: 'KPIWidget' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const AnalyticsDashboard = mongoose.model<IAnalyticsDashboard>('AnalyticsDashboard', analyticsDashboardSchema);
