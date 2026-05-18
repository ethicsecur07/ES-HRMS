import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskReport extends Document {
  employeeId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  inProgressTasks: string;
  completedTasks: string;
  pendingTasks: string;
  blockers: string;
  tomorrowPlan: string;
  submittedAt: Date;
}

const taskReportSchema = new Schema<ITaskReport>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, index: true },
    inProgressTasks: { type: String, required: true },
    completedTasks: { type: String, required: true },
    pendingTasks: { type: String, required: true },
    blockers: { type: String, required: true },
    tomorrowPlan: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const TaskReport = mongoose.model<ITaskReport>('TaskReport', taskReportSchema);
