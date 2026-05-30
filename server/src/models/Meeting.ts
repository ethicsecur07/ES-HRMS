import mongoose, { Schema, Document } from 'mongoose';

export type MeetingType = 'INTERVIEW' | 'CLIENT' | 'TEAM';
export type MeetingStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export interface IMeetingAttendee {
  name: string;
  email: string;
  role?: string; // e.g. 'Interviewer', 'Client', 'Team Member'
}

export interface IMeeting extends Document {
  organizationId?: mongoose.Types.ObjectId;
  title: string;
  meetingType: MeetingType;
  teamsJoinUrl: string;
  teamsMeetingId: string;
  startDateTime: Date;
  endDateTime: Date;
  organizer: string; // email of the organizer
  attendees: IMeetingAttendee[];
  candidateId?: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  notes?: string;
  status: MeetingStatus;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingAttendeeSchema = new Schema<IMeetingAttendee>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String },
  },
  { _id: false }
);

const MeetingSchema = new Schema<IMeeting>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
    title: { type: String, required: true },
    meetingType: {
      type: String,
      enum: ['INTERVIEW', 'CLIENT', 'TEAM'],
      required: true,
    },
    teamsJoinUrl: { type: String, required: true },
    teamsMeetingId: { type: String, required: true },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    organizer: { type: String, required: true },
    attendees: [MeetingAttendeeSchema],
    candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    notes: { type: String },
    status: {
      type: String,
      enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

MeetingSchema.index({ startDateTime: 1 });
MeetingSchema.index({ meetingType: 1 });
MeetingSchema.index({ status: 1 });
MeetingSchema.index({ createdBy: 1 });

export const Meeting = mongoose.model<IMeeting>('Meeting', MeetingSchema);
