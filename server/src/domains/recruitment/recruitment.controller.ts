import { Request, Response } from 'express';
import { Candidate } from '../../models/Candidate.js';
import { getIO } from '../../sockets/socketHandler.js';
import { generateOfferLetterPdf } from '../../services/offerLetterPdf.service.js';
import { uploadFileToS3, fetchFileBuffer } from '../../utils/s3.js';
import { sendEmail } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { OfferTemplate } from '../../models/OfferTemplate.js';
import { ApplicantModel } from '../../models/applicant.model.js';
import { OrganizationAuthConfig } from '../../models/OrganizationAuthConfig.js';

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

  // Try promoting external Applicant from AWS API
  try {
    const extRes = await fetch(`https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants/${id}`);
    if (extRes.ok) {
      const extData = await extRes.json();
      const applicant = extData.data;
      if (applicant) {
        const name = applicant.name || 'Applicant';
        const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || ' ';
        candidate = new Candidate({
          _id: applicant._id, // Retain original ID!
          firstName,
          lastName,
          email: applicant.email,
          phone: applicant.mobile || applicant.phone || '',
          appliedRole: applicant.role,
          resumeUrl: applicant.resumeUrl,
          stage: 'NEW'
        });
        await candidate.save();
        logger.info(`[RecruitmentController] Promoted external applicant to local candidate: ${applicant.email}`);
        return candidate;
      }
    }
  } catch (err: any) {
    logger.error('[RecruitmentController] External applicant promotion check failed', { error: err.message });
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

    // 3. Fetch all external applicants from AWS API
    let externalApplicants: any[] = [];
    try {
      const extRes = await fetch('https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants');
      if (extRes.ok) {
        const extData = await extRes.json();
        if (extData && Array.isArray(extData.data)) {
          externalApplicants = extData.data;
          logger.info(`[RecruitmentController] Successfully fetched ${externalApplicants.length} external applicants from AWS`);
        }
      }
    } catch (extAppErr: any) {
      logger.error('[RecruitmentController] Failed to fetch external applicants from AWS', { error: extAppErr.message });
    }

    // Load global roundsNeeded settings and deletedExternalIds
    const authReq = req as any;
    const orgId = authReq.user?.organizationId;
    let roundsNeeded = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];
    let deletedExternalIds: string[] = [];
    
    if (orgId) {
      const template = await OfferTemplate.findOne({ organizationId: orgId });
      if (template) {
        if (template.roundsNeeded && template.roundsNeeded.length > 0) {
          roundsNeeded = template.roundsNeeded;
        }
        if (template.deletedExternalIds && template.deletedExternalIds.length > 0) {
          deletedExternalIds = template.deletedExternalIds.map((id: string) => id.toString());
        }
      }
    }

    const deletedSet = new Set(deletedExternalIds);

    // 4. Merge them dynamically, avoiding duplicate emails and deleted entries
    const mergedApplicants = [
      ...localApplicants,
      ...externalApplicants
    ];

    const mappedApplicants = mergedApplicants
      .filter(app => {
        const appId = app._id?.toString();
        return app.email && !localEmails.has(app.email.toLowerCase().trim()) && !deletedSet.has(appId);
      })
      .map(app => {
        const name = app.name || 'Applicant';
        const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
        const lastName = lastNameParts.join(' ') || ' ';
        // Add to Set to prevent subsequent list from adding the same email
        localEmails.add(app.email.toLowerCase().trim());
        return {
          _id: app._id,
          firstName,
          lastName,
          email: app.email,
          phone: app.mobile || app.phone || '',
          appliedRole: app.role || 'Applicant',
          resumeUrl: app.resumeUrl || '',
          stage: 'NEW',
          createdAt: app.createdAt || new Date(),
          updatedAt: app.updatedAt || new Date(),
          isLocalApplicant: true
        };
      });

    // Also filter local candidates that were explicitly deleted (blacklisted)
    const candidates = [
      ...localCandidates.filter((c: any) => !deletedSet.has(c._id.toString())),
      ...mappedApplicants
    ];

    res.status(200).json({ success: true, candidates, roundsNeeded });
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
    const authReq = req as any;
    const orgId = authReq.user?.organizationId;

    const candidate = await Candidate.findByIdAndDelete(id);
    const applicant = await ApplicantModel.findByIdAndDelete(id);

    // Blacklist this ID so it won't reappear from external AWS source
    if (orgId) {
      await OfferTemplate.findOneAndUpdate(
        { organizationId: orgId },
        { $addToSet: { deletedExternalIds: id.toString() } },
        { upsert: false } // Only add to existing templates
      );
    }

    // Also attempt to delete from the external AWS API in case it is an external applicant
    let externalDeleted = false;
    try {
      const extRes = await fetch(`https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants/${id}`, {
        method: 'DELETE'
      });
      if (extRes.ok) {
        externalDeleted = true;
        logger.info(`[RecruitmentController] Successfully deleted external applicant ${id}`);
      }
    } catch (extErr: any) {
      logger.error('[RecruitmentController] External applicant deletion failed/skipped', { error: extErr.message });
    }

    if (!candidate && !applicant && !externalDeleted) {
      logger.warn(`[RecruitmentController] Candidate/Applicant ${id} not found locally or externally. Proceeding with UI clearing.`);
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

    // Fetch Organization Custom Microsoft OAuth2 Credentials from DB if available
    const orgId = (req as any).user?.organizationId;
    let microsoftCredentials: { tenantId: string; clientId: string; clientSecret: string } | undefined;

    if (orgId) {
      try {
        const authConfig = await OrganizationAuthConfig.findOne({
          organizationId: orgId,
          provider: 'MICROSOFT',
          isEnabled: true
        });
        
        if (authConfig && authConfig.tenantId && authConfig.clientId && authConfig.clientSecret) {
          microsoftCredentials = {
            tenantId: authConfig.tenantId,
            clientId: authConfig.clientId,
            clientSecret: authConfig.clientSecret
          };
          logger.info(`[RecruitmentController] Found active Microsoft Organization Auth Config for orgId: ${orgId}. Using dynamic credentials.`);
        }
      } catch (err: any) {
        logger.error('[RecruitmentController] Failed to query OrganizationAuthConfig', { error: err.message });
      }
    }

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
        ],
        microsoftCredentials
      });
    } catch (mailErr: any) {
      logger.error('[RecruitmentController] sendEmail failed, but continuing response', { error: mailErr.message || mailErr });
      emailSent = false;
      emailError = mailErr.message || 'Email delivery failed.';
    }

    getIO()?.emit('candidate_updated', candidate);

    if (emailSent) {
      res.status(200).json({
        success: true,
        message: 'Offer letter generated and sent successfully',
        data: {
          candidate
        }
      });
    } else {
      res.status(200).json({ 
        success: true, 
        message: 'Offer letter was generated and uploaded successfully, but email delivery failed.', 
        data: {
          warning: true,
          emailError,
          candidate
        }
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
      if (!template.roundsNeeded || template.roundsNeeded.length === 0) {
        template.roundsNeeded = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];
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
export const scheduleInterview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authReq = req as any;
    const userId = authReq.user?.id;
    const orgId = authReq.user?.organizationId;

    const {
      date,
      interviewer,
      interviewerEmail,
      duration = 60, // minutes
      notes,
      attendees = [],
    } = req.body;

    if (!date || !interviewer) {
      res.status(400).json({ success: false, message: 'Missing required fields: date, interviewer' });
      return;
    }

    const candidate = await findOrCreateCandidate(id);
    if (!candidate) {
      res.status(404).json({ success: false, message: 'Candidate not found' });
      return;
    }

    // Build start and end times
    const startDateTime = new Date(date).toISOString();
    const endDate = new Date(date);
    endDate.setMinutes(endDate.getMinutes() + duration);
    const endDateTime = endDate.toISOString();

    // Fetch org Microsoft credentials if available
    let microsoftCredentials: { tenantId: string; clientId: string; clientSecret: string } | undefined;
    if (orgId) {
      try {
        const authConfig = await OrganizationAuthConfig.findOne({
          organizationId: orgId,
          provider: 'MICROSOFT',
          isEnabled: true,
        });
        if (authConfig?.tenantId && authConfig?.clientId && authConfig?.clientSecret) {
          microsoftCredentials = {
            tenantId: authConfig.tenantId,
            clientId: authConfig.clientId,
            clientSecret: authConfig.clientSecret,
          };
        }
      } catch (err: any) {
        logger.error('[RecruitmentController] Failed to query OrganizationAuthConfig for interview', { error: err.message });
      }
    }

    // Build attendees list
    const meetingAttendees = [
      { name: `${candidate.firstName} ${candidate.lastName}`, email: candidate.email, role: 'Candidate' },
      ...(interviewerEmail ? [{ name: interviewer, email: interviewerEmail, role: 'Interviewer' }] : []),
      ...attendees,
    ];

    // Create Teams meeting
    const { createTeamsMeeting } = await import('../../services/teamsMeeting.service.js');
    const teamsMeeting = await createTeamsMeeting({
      subject: `Interview: ${candidate.firstName} ${candidate.lastName} — ${candidate.appliedRole}`,
      startDateTime,
      endDateTime,
      attendees: meetingAttendees.map((a: any) => ({ name: a.name, email: a.email })),
      meetingType: 'INTERVIEW',
      microsoftCredentials,
    });

    // Update candidate with interview schedule + Teams link
    candidate.interviewSchedule = {
      date: new Date(date),
      interviewer,
      teamsJoinUrl: teamsMeeting.joinUrl,
      meetingId: teamsMeeting.meetingId,
    };
    await candidate.save();

    // Persist a Meeting record
    const { Meeting } = await import('../../models/Meeting.js');
    const meetingRecord = new Meeting({
      organizationId: orgId,
      title: `Interview: ${candidate.firstName} ${candidate.lastName} — ${candidate.appliedRole}`,
      meetingType: 'INTERVIEW',
      teamsJoinUrl: teamsMeeting.joinUrl,
      teamsMeetingId: teamsMeeting.meetingId,
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
      organizer: process.env.SMTP_USER || 'suseendrakumar@ethicsecur.co.in',
      attendees: meetingAttendees,
      candidateId: candidate._id,
      notes,
      status: 'SCHEDULED',
      createdBy: userId,
    });
    await meetingRecord.save();

    // Emit socket event
    getIO()?.emit('meeting_scheduled', {
      meeting: meetingRecord,
      joinUrl: teamsMeeting.joinUrl,
    });
    getIO()?.emit('candidate_updated', candidate);

    // Optionally send email notification to candidate and interviewer
    try {
      const redirectJoinUrl = `${req.protocol}://${req.headers.host}/api/meetings/join/${meetingRecord._id}`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Congratulations!</h2>
            <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">You have been Shortlisted for the Next Round</p>
          </div>
          
          <!-- Body Content -->
          <div style="padding: 32px 24px; background-color: #ffffff; text-align: left;">
            <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Dear <strong>${candidate.firstName} ${candidate.lastName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">Thank you for your interest in joining <strong>ES EthicSecur SofTec</strong>. We are pleased to inform you that your application has been shortlisted, and we would like to invite you for the next round of interviews for the position of <strong>${candidate.appliedRole}</strong>.</p>
            
            <!-- Round Details Card -->
            <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; margin: 24px 0; border-radius: 8px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Round & Schedule Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Position:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${candidate.appliedRole}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Interview Date:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)</td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Interviewer:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${interviewer}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Duration:</td>
                  <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${duration} minutes</td>
                </tr>
              </table>
            </div>
            
            <!-- Call to Action -->
            <div style="text-align: center; margin: 32px 0 24px;">
              <a href="${redirectJoinUrl}" target="_blank" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1); transition: background-color 0.2s;">
                Join Microsoft Teams Interview
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 32px;">Please join the Teams link 5 minutes prior to your scheduled time.</p>
            
            <!-- Company Details -->
            <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
              <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">About ES EthicSecur SofTec</h4>
              <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280; line-height: 1.5;">ES EthicSecur SofTec is a premier enterprise software and security technologies company delivering state-of-the-art software solutions, system integrations, and human resource management applications.</p>
              
              <table style="width: 100%; font-size: 12.5px; color: #4b5563; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; vertical-align: top; width: 60px; font-weight: 600;">Office:</td>
                  <td style="padding: 4px 0; color: #6b7280;">2nd Floor, NV Arcade Building, Near 5 Roads (Next to Reliance Mall), Salem - 636004, Tamil Nadu</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; vertical-align: top; font-weight: 600;">Website:</td>
                  <td style="padding: 4px 0;"><a href="https://www.ethicsecur.com" style="color: #4f46e5; text-decoration: none;">www.ethicsecur.com</a></td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; vertical-align: top; font-weight: 600;">Contact:</td>
                  <td style="padding: 4px 0; color: #6b7280;">info@ethicsecur.com | +91 755028487</td>
                </tr>
              </table>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0;">This is an automated candidate notification from the ES EthicSecur HRMS portal.</p>
            <p style="margin: 4px 0 0;">© 2026 ES EthicSecur SofTec Pvt Ltd. All rights reserved.</p>
          </div>
        </div>
      `;

      // Send to candidate
      await sendEmail({
        to: candidate.email,
        subject: `Congratulations! Shortlisted for Next Round — ${candidate.appliedRole} - ES EthicSecur SofTec`,
        text: `Dear ${candidate.firstName},\n\nWe are pleased to inform you that you have been shortlisted for the next round of interviews for the position of ${candidate.appliedRole} at ES EthicSecur SofTec.\n\nYour interview has been scheduled on ${new Date(date).toLocaleString()}.\n\nInterviewer: ${interviewer}\nDuration: ${duration} minutes\n\nJoin the Teams meeting here: ${redirectJoinUrl}\n\nOffice Address: 2nd Floor, NV Arcade Building, Near 5 Roads, Next to Reliance Mall, Salem - 636004.\nWebsite: www.ethicsecur.com\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`,
        html: emailHtml,
        microsoftCredentials,
      });

      // Send detailed assignment email to interviewer
      if (interviewerEmail) {
        const interviewerHtml = `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 32px 24px; text-align: center; color: white;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Interview Assignment</h2>
              <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">You are scheduled to conduct an interview</p>
            </div>
            
            <!-- Body Content -->
            <div style="padding: 32px 24px; background-color: #ffffff; text-align: left;">
              <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">Dear <strong>${interviewer}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #4b5563;">You have been assigned to conduct an interview for the candidate <strong>${candidate.firstName} ${candidate.lastName}</strong> for the position of <strong>${candidate.appliedRole}</strong>.</p>
              
              <!-- Round Details Card -->
              <div style="background-color: #f8fafc; border-left: 4px solid #0f172a; padding: 20px; margin: 24px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Interview Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 140px;">Candidate:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${candidate.firstName} ${candidate.lastName}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Position:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${candidate.appliedRole}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Interview Date:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Time:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Duration:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-weight: 700;">${duration} minutes</td>
                  </tr>
                </table>
              </div>
              
              <!-- Call to Action -->
              <div style="text-align: center; margin: 32px 0 24px;">
                <a href="${redirectJoinUrl}" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; transition: background-color 0.2s;">
                  Join Interview Room
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 32px;">The join link will become active 15 minutes before the start time.</p>
              
              <!-- Interviewer Guide / Tracking -->
              <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">Interviewer Instructions & Process Tracking</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #6b7280; line-height: 1.6;">
                  <li>Verify the candidate's identity and matching profile details.</li>
                  <li>Review the resume directly inside the HRMS candidate details portal.</li>
                  <li>After completing the interview, please log into your **HRMS Portal** and navigate to **Recruitment -> Evaluation** to submit your feedback, communication ratings, and technical scores.</li>
                </ul>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">This is an automated interviewer assignment from the ES EthicSecur HRMS portal.</p>
              <p style="margin: 4px 0 0;">© 2026 ES EthicSecur SofTec Pvt Ltd. All rights reserved.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: interviewerEmail,
          subject: `Interview Assignment: ${candidate.firstName} ${candidate.lastName} — ${candidate.appliedRole}`,
          text: `Dear ${interviewer},\n\nYou have been assigned to conduct an interview for ${candidate.firstName} ${candidate.lastName} for the position of ${candidate.appliedRole}.\n\nScheduled: ${new Date(date).toLocaleString()}.\nDuration: ${duration} minutes.\n\nJoin the room here: ${redirectJoinUrl}\n\nAfter the interview, please log into HRMS to submit your technical and communication ratings.`,
          html: interviewerHtml,
          microsoftCredentials,
        });
      }
    } catch (emailErr: any) {
      logger.warn(`[RecruitmentController] Interview email notification failed: ${emailErr.message}`);
    }

    logger.info(`[RecruitmentController] Interview scheduled for candidate ${candidate.email} with Teams meeting.`);

    res.status(201).json({
      success: true,
      message: 'Interview scheduled with Teams meeting',
      data: {
        candidate,
        joinUrl: teamsMeeting.joinUrl,
        meeting: meetingRecord,
      }
    });
  } catch (error: any) {
    logger.error('[RecruitmentController] scheduleInterview error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

