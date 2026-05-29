"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOfferTemplate = exports.getOfferTemplate = exports.sendCandidateOffer = exports.deleteCandidate = exports.updateCandidate = exports.updateCandidateStage = exports.getCandidates = exports.createCandidate = void 0;
const Candidate_js_1 = require("../../models/Candidate.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const offerLetterPdf_service_js_1 = require("../../services/offerLetterPdf.service.js");
const s3_js_1 = require("../../utils/s3.js");
const email_service_js_1 = require("../../services/email.service.js");
const logger_js_1 = require("../../utils/logger.js");
const OfferTemplate_js_1 = require("../../models/OfferTemplate.js");
const createCandidate = async (req, res) => {
    try {
        const candidate = new Candidate_js_1.Candidate(req.body);
        await candidate.save();
        (0, socketHandler_js_1.getIO)()?.emit('candidate_created', candidate);
        res.status(201).json({ success: true, candidate });
    }
    catch (error) {
        let message = error.message;
        if (error.code === 11000) {
            message = 'A candidate with this email address already exists in the database.';
        }
        res.status(400).json({ success: false, message });
    }
};
exports.createCandidate = createCandidate;
const getCandidates = async (req, res) => {
    try {
        const candidates = await Candidate_js_1.Candidate.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, candidates });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCandidates = getCandidates;
const updateCandidateStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;
        const candidate = await Candidate_js_1.Candidate.findByIdAndUpdate(id, { stage }, { new: true });
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_updated', candidate);
        res.status(200).json({ success: true, candidate });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updateCandidateStage = updateCandidateStage;
const updateCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findByIdAndUpdate(id, req.body, { new: true });
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_updated', candidate);
        res.status(200).json({ success: true, candidate });
    }
    catch (error) {
        let message = error.message;
        if (error.code === 11000) {
            message = 'A candidate with this email address already exists in the database.';
        }
        res.status(400).json({ success: false, message });
    }
};
exports.updateCandidate = updateCandidate;
const deleteCandidate = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findByIdAndDelete(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_deleted', { candidateId: id });
        res.status(200).json({ success: true, message: 'Candidate deleted' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteCandidate = deleteCandidate;
const sendCandidateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findById(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        const { date, candidateName, address, appliedRole, duration, startDate, endDate, stipendDetails, technologies, footerPhone, footerEmail, footerWebsite, footerAddress, bodyText, signatoryName, signatoryTitle, pdfTitle, pdfSubject, emailSubject, emailBody, customPdfUrl, salaryOffered = 0 } = req.body;
        let pdfBuffer;
        let uploadedUrl;
        let fileName;
        if (customPdfUrl) {
            logger_js_1.logger.info(`[RecruitmentController] Using custom uploaded PDF offer letter for ${candidateName}: ${customPdfUrl}`);
            uploadedUrl = customPdfUrl;
            // Extract the filename from the URL, ignoring query parameters (like Cloudinary versioning)
            fileName = customPdfUrl.split('/').pop()?.split('?')[0] || `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
            try {
                pdfBuffer = await (0, s3_js_1.fetchFileBuffer)(customPdfUrl);
            }
            catch (fetchErr) {
                logger_js_1.logger.error('[RecruitmentController] Failed to fetch custom PDF buffer', { error: fetchErr.message });
                throw new Error(`Failed to fetch custom uploaded PDF offer letter: ${fetchErr.message}`);
            }
        }
        else {
            logger_js_1.logger.info(`[RecruitmentController] Generating PDF offer letter for candidate: ${candidateName}`);
            // 1. Generate PDF buffer using PDFKit service
            pdfBuffer = await (0, offerLetterPdf_service_js_1.generateOfferLetterPdf)({
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
            uploadedUrl = await (0, s3_js_1.uploadFileToS3)(pdfBuffer, fileName, 'application/pdf');
            logger_js_1.logger.info(`[RecruitmentController] Offer letter uploaded successfully: ${uploadedUrl}`);
        }
        // 3. Update candidate stage & offer details
        candidate.stage = 'OFFER';
        candidate.offerDetails = {
            salaryOffered,
            offerLetterUrl: uploadedUrl,
            status: 'PENDING'
        };
        await candidate.save();
        // 4. Send Email via SMTP
        const finalSubject = emailSubject || `Job Offer: ${appliedRole} - ES EthicSecur SofTec Pvt Ltd`;
        const finalBodyText = emailBody || `Dear ${candidateName},\n\nWe are pleased to extend a formal offer of employment to you for the position of ${appliedRole} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.\n\nTo accept this offer, please sign the letter and return it by replying to this email.\n\nWe look forward to welcoming you to the team!\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`;
        const formattedHtmlParagraphs = finalBodyText.split('\n\n').map((p) => `<p style="font-size: 14px; margin-bottom: 12px; white-space: pre-line;">${p.trim()}</p>`).join('');
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
            await (0, email_service_js_1.sendEmail)({
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
        }
        catch (mailErr) {
            logger_js_1.logger.error('[RecruitmentController] sendEmail failed, but continuing response', { error: mailErr.message || mailErr });
            emailSent = false;
            emailError = mailErr.message || 'Email delivery failed.';
        }
        (0, socketHandler_js_1.getIO)()?.emit('candidate_updated', candidate);
        if (emailSent) {
            res.status(200).json({ success: true, message: 'Offer letter generated and sent successfully', candidate });
        }
        else {
            res.status(200).json({
                success: true,
                warning: true,
                message: 'Offer letter was generated and uploaded successfully, but email delivery failed.',
                emailError,
                candidate
            });
        }
    }
    catch (error) {
        logger_js_1.logger.error('[RecruitmentController] sendCandidateOffer error', { error });
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.sendCandidateOffer = sendCandidateOffer;
const formatDateStr = (dateStr) => {
    if (!dateStr)
        return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    catch {
        return dateStr;
    }
};
const getOfferTemplate = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        let template = await OfferTemplate_js_1.OfferTemplate.findOne({ organizationId: orgId });
        if (!template) {
            template = new OfferTemplate_js_1.OfferTemplate({
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
        }
        else {
            let updated = false;
            if (!template.pdfTitle) {
                template.pdfTitle = 'Internship Offer Letter';
                updated = true;
            }
            if (!template.pdfSubject) {
                template.pdfSubject = 'Subject: Intern Offer letter- {{appliedRole}}';
                updated = true;
            }
            if (!template.emailBody) {
                template.emailBody = `Dear {{candidateName}},\n\nWe are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec. Please review the attached PDF Offer Letter containing the comprehensive terms of your employment, starting date, and conditions.\n\nTo accept this offer, please sign the letter and return it by replying to this email.\n\nWe look forward to welcoming you to the team!\n\nBest regards,\nHR Department\nES EthicSecur SofTec Pvt Ltd`;
                updated = true;
            }
            if (updated) {
                await template.save();
            }
        }
        res.status(200).json({ success: true, template });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOfferTemplate = getOfferTemplate;
const updateOfferTemplate = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        const template = await OfferTemplate_js_1.OfferTemplate.findOneAndUpdate({ organizationId: orgId }, { ...req.body, organizationId: orgId }, { upsert: true, new: true });
        res.status(200).json({ success: true, template });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.updateOfferTemplate = updateOfferTemplate;
