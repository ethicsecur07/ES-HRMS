import mongoose, { Schema, Document } from 'mongoose';

export interface IOfferTemplate extends Document {
  name: string;
  subject: string; // This is the Email Subject
  bodyText: string; // This is the PDF Body Text
  pdfTitle: string; // E.g., 'Internship Offer Letter'
  pdfSubject: string; // E.g., 'Subject: Intern Offer letter- {{appliedRole}}'
  emailBody: string; // This is the Email Body Text
  footerPhone: string;
  footerEmail: string;
  footerWebsite: string;
  footerAddress: string;
  signatoryName: string;
  signatoryTitle: string;
  organizationId: mongoose.Types.ObjectId;
}

const OfferTemplateSchema = new Schema<IOfferTemplate>(
  {
    name: { type: String, required: true, default: 'Default Offer Template' },
    subject: { type: String, required: true, default: 'Job Offer: {{appliedRole}} - ES EthicSecur SofTec Pvt Ltd' },
    bodyText: { type: String, required: true },
    pdfTitle: { type: String, required: true, default: 'Internship Offer Letter' },
    pdfSubject: { type: String, required: true, default: 'Subject: Intern Offer letter- {{appliedRole}}' },
    emailBody: { 
      type: String, 
      required: true,
      default: `Dear {{candidateName}},

We are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.

To accept this offer, please sign the letter and return it by replying to this email.

We look forward to welcoming you to the team!

Best regards,
HR Department
ES EthicSecur SofTec Pvt Ltd`
    },
    footerPhone: { type: String, default: '755028487' },
    footerEmail: { type: String, default: 'info@ethicsecur.com' },
    footerWebsite: { type: String, default: 'www.ethicsecur.com' },
    footerAddress: { type: String, default: '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004' },
    signatoryName: { type: String, default: 'ES EthicSecur SofTec Private Limited' },
    signatoryTitle: { type: String, default: 'HR Department' },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true }
  },
  { timestamps: true }
);

export const OfferTemplate = mongoose.model<IOfferTemplate>('OfferTemplate', OfferTemplateSchema);
