import mongoose, { Schema, Document } from 'mongoose';

export interface ICandidate extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  appliedRole: string;
  stage: 'NEW' | 'SCREENING' | 'INTERVIEW' | 'TECHNICAL' | 'HR' | 'OFFER' | 'HIRED';
  interviewSchedule?: {
    date: Date;
    interviewer: string;
  };
  offerDetails?: {
    salaryOffered: number;
    offerLetterUrl?: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CandidateSchema = new Schema<ICandidate>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    resumeUrl: { type: String },
    appliedRole: { type: String, required: true },
    stage: {
      type: String,
      enum: ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'],
      default: 'NEW'
    },
    interviewSchedule: {
      date: { type: Date },
      interviewer: { type: String }
    },
    offerDetails: {
      salaryOffered: { type: Number },
      offerLetterUrl: { type: String },
      status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' }
    },
    notes: { type: String }
  },
  { timestamps: true }
);

export const Candidate = mongoose.model<ICandidate>('Candidate', CandidateSchema);
