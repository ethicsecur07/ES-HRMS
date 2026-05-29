import { Request, Response } from 'express';
import { Candidate } from '../../models/Candidate.js';
import { getIO } from '../../sockets/socketHandler.js';
import { generateOfferLetterPdf } from '../../services/offerLetterPdf.service.js';
import { uploadFileToS3, fetchFileBuffer } from '../../utils/s3.js';
import { sendEmail } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { OfferTemplate } from '../../models/OfferTemplate.js';
import { ApplicantModel } from '../../models/applicant.model.js';

const findOrCreateCandidate = async (id: string): Promise<any> => {
  let candidate = await Candidate.findById(id);
  if (candidate) return candidate;

  // Try promoting local Applicant
  try {
    const applicant = await ApplicantModel.findById(id);
    if (applicant) {
      const name = applicant.name || 'Applicant';
      const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
      const lastName = lastNameParts.join(' ') || ' ';
      candidate = new Candidate({
        _id: applicant._id, // Retain original ID!
        firstName,
        lastName,
        email: applicant.email,
        phone: applicant.mobile,
        appliedRole: applicant.role,
        resumeUrl: applicant.resumeUrl,
        stage: 'NEW'
      });
      await candidate.save();
      logger.info(`[RecruitmentController] Promoted local applicant to candidate: ${applicant.email}`);
      return candidate;
    }
  } catch (err: any) {
    logger.error('[RecruitmentController] Local applicant promotion check failed', { error: err.message });
  }

  // Try promoting external Applicant
  try {
    const extRes = await fetch(`https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants/${id}`);
    if (extRes.ok) {
      const payload = await extRes.json();
      const app = payload.data;
      if (app) {
        const name = app.name || 'Applicant';
        const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || ' ';
        candidate = new Candidate({
          _id: app._id, // Retain original ID!
          firstName,
          lastName,
          email: app.email,
          phone: app.mobile || '',
          appliedRole: app.role || 'Applicant',
          resumeUrl: app.resumeUrl || '',
          stage: 'NEW'
        });
        await candidate.save();
        logger.info(`[RecruitmentController] Promoted external applicant to candidate: ${app.email}`);
        return candidate;
      }
    }
  } catch (extErr: any) {
    logger.error('[RecruitmentController] External applicant promotion check failed', { error: extErr.message });
  }

  return null;
};

export const createCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    
    getIO()?.emit('candidate_created', candidate);
    
    res.status(201).json({ success: true, candidate });
  } catch (error: any) {
    let message = error.message;
    if (error.code === 11000) {
      message = 'A candidate with this email address already exists in the database.';
    }
    res.status(400).json({ success: false, message });
  }
};

export const getCandidates = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Fetch all local candidate documents
    const localCandidates = await Candidate.find().sort({ createdAt: -1 });
    const localEmails = new Set(localCandidates.map(c => c.email.toLowerCase().trim()));

    // 2. Fetch all local applicant documents
    let localApplicants: any[] = [];
    try {
      localApplicants = await ApplicantModel.find().sort({ createdAt: -1 });
    } catch (localAppErr: any) {
      logger.error('[RecruitmentController] Failed to fetch local applicants', { error: localAppErr.message });
    }

    // 3. Fetch all external applicants
    let externalApplicants: any[] = [];
    try {
      const extRes = await fetch('https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants');
      if (extRes.ok) {
        const payload = await extRes.json();
        externalApplicants = payload.data || [];
      }
    } catch (extErr: any) {
      logger.error('[RecruitmentController] Failed to fetch external applicants', { error: extErr.message });
    }

    // 4. Merge them dynamically, avoiding duplicate emails
    const mappedLocalApplicants = localApplicants
      .filter(app => app.email && !localEmails.has(app.email.toLowerCase().trim()))
      .map(app => {
        const name = app.name || 'Applicant';
        const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || ' ';
        // Add to Set to prevent subsequent external list from adding the same email
        localEmails.add(app.email.toLowerCase().trim());
        return {
          _id: app._id,
          firstName,
          lastName,
          email: app.email,
          phone: app.mobile || '',
          appliedRole: app.role || 'Applicant',
          resumeUrl: app.resumeUrl || '',
          stage: 'NEW',
          createdAt: app.createdAt || new Date(),
          updatedAt: app.updatedAt || new Date(),
          isLocalApplicant: true
        };
      });

    const mappedExternalApplicants = externalApplicants
      .filter(app => app.email && !localEmails.has(app.email.toLowerCase().trim()))
      .map(app => {
        const name = app.name || 'Applicant';
        const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || ' ';
        return {
          _id: app._id,
          firstName,
          lastName,
          email: app.email,
          phone: app.mobile || '',
          appliedRole: app.role || 'Applicant',
          resumeUrl: app.resumeUrl || '',
          stage: 'NEW',
          createdAt: app.createdAt ? new Date(app.createdAt) : new Date(),
          updatedAt: app.updatedAt ? new Date(app.updatedAt) : new Date(),
          isExternal: true
        };
      });

    const candidates = [
      ...localCandidates,
      ...mappedLocalApplicants,
      ...mappedExternalApplicants
    ];

    res.status(200).json({ success: true, candidates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCandidateStage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const candidate = await findOrCreateCandidate(id);

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    candidate.stage = stage;
    await candidate.save();

    getIO()?.emit('candidate_updated', candidate);

    res.status(200).json({ success: true, candidate });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    let candidate = await findOrCreateCandidate(id);

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    Object.assign(candidate, req.body);
    await candidate.save();

    getIO()?.emit('candidate_updated', candidate);

    res.status(200).json({ success: true, candidate });
  } catch (error: any) {
    let message = error.message;
    if (error.code === 11000) {
      message = 'A candidate with this email address already exists in the database.';
    }
    res.status(400).json({ success: false, message });
  }
};

export const deleteCandidate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const candidate = await Candidate.findByIdAndDelete(id);
    const applicant = await ApplicantModel.findByIdAndDelete(id);

    if (!candidate && !applicant) {
      res.status(404).json({ success: false, message: 'Candidate or Applicant not found' });
      return;
    }

    getIO()?.emit('candidate_deleted', { candidateId: id });

    res.status(200).json({ success: true, message: 'Candidate deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendCandidateOffer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const candidate = await findOrCreateCandidate(id);

    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    const {
      date,
      candidateName,
      address,
      appliedRole,
      duration,
      startDate,
      endDate,
      stipendDetails,
      technologies,
      footerPhone,
      footerEmail,
      footerWebsite,
      footerAddress,
      bodyText,
      signatoryName,
      signatoryTitle,
      pdfTitle,
      pdfSubject,
      emailSubject,
      emailBody,
      customPdfUrl,
      customPdfBase64,
      customPdfName,
      salaryOffered = 0
    } = req.body;

    let pdfBuffer: Buffer;
    let uploadedUrl: string;
    let fileName: string;

    if (customPdfBase64) {
      logger.info(`[RecruitmentController] Using custom base64 PDF offer letter: ${customPdfName}`);
      fileName = customPdfName || `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
      try {
        pdfBuffer = Buffer.from(customPdfBase64, 'base64');
        uploadedUrl = await uploadFileToS3(pdfBuffer, fileName, 'application/pdf');
        logger.info(`[RecruitmentController] Custom PDF uploaded successfully: ${uploadedUrl}`);
      } catch (uploadErr: any) {
        logger.error('[RecruitmentController] Failed to process/upload custom PDF base64', { error: uploadErr.message });
        throw new Error(`Failed to upload custom PDF offer letter: ${uploadErr.message}`);
      }
    } else if (customPdfUrl) {
      logger.info(`[RecruitmentController] Using custom uploaded PDF offer letter URL for ${candidateName}: ${customPdfUrl}`);
      uploadedUrl = customPdfUrl;
      // Extract the filename from the URL, ignoring query parameters (like Cloudinary versioning)
      fileName = customPdfUrl.split('/').pop()?.split('?')[0] || `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
      try {
        pdfBuffer = await fetchFileBuffer(customPdfUrl);
      } catch (fetchErr: any) {
        logger.error('[RecruitmentController] Failed to fetch custom PDF buffer', { error: fetchErr.message });
        throw new Error(`Failed to fetch custom uploaded PDF offer letter: ${fetchErr.message}`);
      }
    } else {
      logger.info(`[RecruitmentController] Generating PDF offer letter for candidate: ${candidateName}`);

      // 1. Generate PDF buffer using PDFKit service
      pdfBuffer = await generateOfferLetterPdf({
        date,
        candidateName,
        address,
        appliedRole,
        duration,
        startDate,
        endDate,
        stipendDetails,
        technologies,
        footerPhone,
        footerEmail,
        footerWebsite,
        footerAddress,
        bodyText,
        signatoryName,
        signatoryTitle,
        pdfTitle,
        pdfSubject,
        candidateEmail: candidate.email
      });

      // 2. Upload PDF to S3/Cloudinary
      fileName = `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
      uploadedUrl = await uploadFileToS3(pdfBuffer, fileName, 'application/pdf');
      logger.info(`[RecruitmentController] Offer letter uploaded successfully: ${uploadedUrl}`);
    }

    // 3. Update candidate stage & offer details
    candidate.stage = 'OFFER';
    candidate.offerDetails = {
      salaryOffered,
      offerLetterUrl: uploadedUrl,
      offerLetterBase64: pdfBuffer.toString('base64'),
      status: 'PENDING'
    };
    await candidate.save();

    // 4. Send Email via SMTP
    const finalSubject = emailSubject || `Job Offer: ${appliedRole} - ES EthicSecur SofTec Pvt Ltd`;
    const finalBodyText = emailBody || `Dear ${candidateName},\n\nWe are pleased to extend a formal offer of employment to you for the position of ${appliedRole} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.\n\nTo accept this offer, please sign the letter and return it by replying to this email.\n\nWe look forward to welcoming you to the team!\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`;

    const formattedHtmlParagraphs = finalBodyText.split('\n\n').map((p: string) => `<p style="font-size: 14px; margin-bottom: 12px; white-space: pre-line;">${p.trim()}</p>`).join('');

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #d35400, #e67e22); padding: 24px; text-align: center; color: white;">
          <h2 style="margin: 0; font-size: 22px;">Job Offer Extended</h2>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">ES EthicSecur SofTec Pvt Ltd</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff; text-align: left;">
          ${formattedHtmlParagraphs}
          
          <div style="background-color: #f9f9f9; border-left: 4px solid #e67e22; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <table style="width: 100%; font-size: 13.5px; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; color: #666; font-weight: bold; width: 120px;">Position:</td>
                <td style="padding: 4px 0; color: #333;">${appliedRole}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666; font-weight: bold;">Start Date:</td>
                <td style="padding: 4px 0; color: #333;">${formatDateStr(startDate)}</td>
              </tr>
              ${endDate ? `
              <tr>
                <td style="padding: 4px 0; color: #666; font-weight: bold;">End Date:</td>
                <td style="padding: 4px 0; color: #333;">${formatDateStr(endDate)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 4px 0; color: #666; font-weight: bold;">Duration:</td>
                <td style="padding: 4px 0; color: #333;">${duration}</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 14.5px; margin-top: 15px;">Please find the official offer letter attached as a PDF file.</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 16px; text-align: center; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
          <p style="margin: 0;">This email is sent on behalf of ES EthicSecur SofTec Pvt Ltd.</p>
          <p style="margin: 4px 0 0;">Phone: ${footerPhone || '755028487'} | Email: ${footerEmail || 'info@ethicsecur.com'}</p>
        </div>
      </div>
    `;

    let emailSent = true;
    let emailError = '';
    try {
      await sendEmail({
        to: candidate.email,
        subject: finalSubject,
        text: finalBodyText,
        html: emailHtml,
        attachments: [
          {
            filename: fileName,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
    } catch (mailErr: any) {
      logger.error('[RecruitmentController] sendEmail failed, but continuing response', { error: mailErr.message || mailErr });
      emailSent = false;
      emailError = mailErr.message || 'Email delivery failed.';
    }

    getIO()?.emit('candidate_updated', candidate);

    if (emailSent) {
      res.status(200).json({ success: true, message: 'Offer letter generated and sent successfully', candidate });
    } else {
      res.status(200).json({ 
        success: true, 
        warning: true,
        message: 'Offer letter was generated and uploaded successfully, but email delivery failed.', 
        emailError,
        candidate 
      });
    }
  } catch (error: any) {
    logger.error('[RecruitmentController] sendCandidateOffer error', { error });
    res.status(500).json({ success: false, message: error.message });
  }
};

const formatDateStr = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

export const getOfferTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const orgId = authReq.user?.organizationId;

    let template = await OfferTemplate.findOne({ organizationId: orgId });
    if (!template) {
      template = new OfferTemplate({
        name: 'Default Offer Template',
        subject: 'Intern Offer letter- {{appliedRole}}',
        pdfTitle: 'Internship Offer Letter',
        pdfSubject: 'Subject: Intern Offer letter- {{appliedRole}}',
        bodyText: `We are pleased to offer you an opportunity to join ES EthicSecur SofTec Pvt Ltd., as an Intern for a period of {{duration}} on a {{stipendDetails}} basis from {{startDate}} to {{endDate}}

During the internship period, you will be assigned tasks, projects, and learning activities related to your department. This internship is intended to provide practical exposure, skill development, and professional experience.

Please note that no stipend, salary, allowance, or any monetary compensation will be paid during the internship tenure. This internship does not guarantee permanent employment with the company. You are required to follow the company’s working hours, policies, reporting instructions, and maintain discipline, punctuality, and professional conduct at all times.

Based on your performance, attendance, behavior, and business requirements, you may be considered for conversion to a full-time role with stipend after successful completion of the internship. Upon such conversion, it will be mandatory for you to continue working with the company for a minimum period of six (6) months as per the terms of employment shared at that time.
Upon successful completion of the internship, based on your performance and attendance, the company may issue an Internship Completion Certificate or Experience Letter.`,
        emailBody: `Dear {{candidateName}},

We are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.

To accept this offer, please sign the letter and return it by replying to this email.

We look forward to welcoming you to the team!

Best regards,
HR Department
ES EthicSecur SofTec Pvt Ltd`,
        organizationId: orgId
      });
      await template.save();
    } else {
      let updated = false;
      if (!template.pdfTitle) { template.pdfTitle = 'Internship Offer Letter'; updated = true; }
      if (!template.pdfSubject) { template.pdfSubject = 'Subject: Intern Offer letter- {{appliedRole}}'; updated = true; }
      if (!template.emailBody) {
        template.emailBody = `Dear {{candidateName}},\n\nWe are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.\n\nTo accept this offer, please sign the letter and return it by replying to this email.\n\nWe look forward to welcoming you to the team!\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`;
        updated = true;
      }
      if (updated) {
        await template.save();
      }
    }

    res.status(200).json({ success: true, template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOfferTemplate = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const orgId = authReq.user?.organizationId;

    const template = await OfferTemplate.findOneAndUpdate(
      { organizationId: orgId },
      { ...req.body, organizationId: orgId },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, template });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCandidateOfferLetter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const candidate = await Candidate.findById(id);

    if (!candidate || !candidate.offerDetails) {
      res.status(404).json({ success: false, message: 'Offer details not found for this candidate.' });
      return;
    }

    let pdfBuffer: Buffer;
    if (candidate.offerDetails.offerLetterBase64) {
      pdfBuffer = Buffer.from(candidate.offerDetails.offerLetterBase64, 'base64');
    } else if (candidate.offerDetails.offerLetterUrl) {
      logger.info(`[RecruitmentController] Fetching offer letter PDF from URL for download fallback: ${candidate.offerDetails.offerLetterUrl}`);
      try {
        pdfBuffer = await fetchFileBuffer(candidate.offerDetails.offerLetterUrl);
      } catch (fetchErr: any) {
        logger.error('[RecruitmentController] Fallback fetch failed', { error: fetchErr.message });
        res.status(500).json({ success: false, message: `Failed to download offer letter PDF: ${fetchErr.message}` });
        return;
      }
    } else {
      res.status(404).json({ success: false, message: 'Offer letter PDF not found for this candidate.' });
      return;
    }

    const fileName = `Offer_Letter_${candidate.firstName}_${candidate.lastName}.pdf`.replace(/\s+/g, '_');

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `inline; filename="${fileName}"`
    });
    res.end(pdfBuffer);
  } catch (error: any) {
    logger.error('[RecruitmentController] getCandidateOfferLetter error', { error });
    res.status(500).json({ success: false, message: error.message });
  }
};


