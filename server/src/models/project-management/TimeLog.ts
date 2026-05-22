import mongoose, { Schema, Document } from 'mongoose';

export interface ITimeLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  hoursLogged: number;
  isBillable: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timeLogSchema = new Schema<ITimeLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: String, required: true },
    hoursLogged: { type: Number, required: true },
    isBillable: { type: Boolean, default: false },
    notes: { type: String }
  },
  { timestamps: true }
);

timeLogSchema.index({ employeeId: 1, date: 1 });

export const TimeLog = mongoose.model<ITimeLog>('TimeLog', timeLogSchema);
