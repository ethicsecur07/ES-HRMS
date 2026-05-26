import mongoose, { Schema, Document } from 'mongoose';

export interface ITaskComment extends Document {
  organizationId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  authorName: string;
  content: string;
  isReworkNote?: boolean;
  attachments?: { filename: string; url: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const taskCommentSchema = new Schema<ITaskComment>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    content: { type: String, required: true },
    isReworkNote: { type: Boolean, default: false },
    attachments: [
      {
        filename: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

export const TaskComment = mongoose.model<ITaskComment>('TaskComment', taskCommentSchema);
