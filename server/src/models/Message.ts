import mongoose, { Schema, Document } from 'mongoose';

export type MessageType = 'text' | 'file' | 'image';

export interface IMessage extends Document {
  senderId: string;
  receiverId: string;
  content: string;
  messageType: MessageType;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string; // MIME type
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    content: { type: String, default: '' },
    messageType: { type: String, enum: ['text', 'file', 'image'], default: 'text' },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    fileType: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>('Message', messageSchema);
