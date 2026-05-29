import { Schema, model } from 'mongoose';

const ApplicantSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    role: { type: String, required: true },
    resumeUrl: { type: String, required: true },
  },
  { timestamps: true }
);

export const ApplicantModel = model('Applicant', ApplicantSchema);
