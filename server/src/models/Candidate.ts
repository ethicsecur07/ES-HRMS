import mongoose, { Schema, Document } from 'mongoose';

export interface IStageEvaluation {
  stage: 'NEW' | 'SCREENING' | 'INTERVIEW' | 'TECHNICAL' | 'HR' | 'OFFER' | 'HIRED';
  comments?: string;
  ratingCommunication?: number;
  ratingTechnical?: number;
  toolsExperiences?: string;
  completed?: boolean;
  completedAt?: Date;
}

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
    teamsJoinUrl?: string;
    meetingId?: string;
  };
  offerDetails?: {
    salaryOffered: number;
    offerLetterUrl?: string;
    offerLetterBase64?: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  };
  notes?: string;
  evaluations?: IStageEvaluation[];
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
      interviewer: { type: String },
      teamsJoinUrl: { type: String },
      meetingId: { type: String },
    },
    offerDetails: {
      salaryOffered: { type: Number },
      offerLetterUrl: { type: String },
      offerLetterBase64: { type: String },
      status: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED'], default: 'PENDING' }
    },
    notes: { type: String },
    evaluations: [
      {
        stage: { type: String, required: true },
        comments: { type: String },
        ratingCommunication: { type: Number, min: 0, max: 5 },
        ratingTechnical: { type: Number, min: 0, max: 5 },
        toolsExperiences: { type: String },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date }
      }
    ]
  },
  { timestamps: true }
);

export const Candidate = mongoose.model<ICandidate>('Candidate', CandidateSchema);

