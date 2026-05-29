"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCandidateOfferLetter = exports.updateOfferTemplate = exports.getOfferTemplate = exports.sendCandidateOffer = exports.deleteCandidate = exports.updateCandidate = exports.updateCandidateStage = exports.getCandidates = exports.createCandidate = void 0;
const Candidate_js_1 = require("../../models/Candidate.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const offerLetterPdf_service_js_1 = require("../../services/offerLetterPdf.service.js");
const s3_js_1 = require("../../utils/s3.js");
const email_service_js_1 = require("../../services/email.service.js");
const logger_js_1 = require("../../utils/logger.js");
const OfferTemplate_js_1 = require("../../models/OfferTemplate.js");
const applicant_model_js_1 = require("../../models/applicant.model.js");
const OrganizationAuthConfig_js_1 = require("../../models/OrganizationAuthConfig.js");
const findOrCreateCandidate = async (id) => {
    let candidate = await Candidate_js_1.Candidate.findById(id);
    if (candidate)
        return candidate;
    // Try promoting local Applicant
    try {
        const applicant = await applicant_model_js_1.ApplicantModel.findById(id);
        if (applicant) {
            const name = applicant.name || 'Applicant';
            const [firstName = '', ...lastNameParts] = name.trim().split(/\s+/);
            const lastName = lastNameParts.join(' ') || ' ';
            candidate = new Candidate_js_1.Candidate({
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
            logger_js_1.logger.info(`[RecruitmentController] Promoted local applicant to candidate: ${applicant.email}`);
            return candidate;
        }
    }
    catch (err) {
        logger_js_1.logger.error('[RecruitmentController] Local applicant promotion check failed', { error: err.message });
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
                candidate = new Candidate_js_1.Candidate({
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
                logger_js_1.logger.info(`[RecruitmentController] Promoted external applicant to local candidate: ${applicant.email}`);
                return candidate;
            }
        }
    }
    catch (err) {
        logger_js_1.logger.error('[RecruitmentController] External applicant promotion check failed', { error: err.message });
    }
    return null;
};
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
        // 1. Fetch all local candidate documents
        const localCandidates = await Candidate_js_1.Candidate.find().sort({ createdAt: -1 });
        const localEmails = new Set(localCandidates.map(c => c.email.toLowerCase().trim()));
        // 2. Fetch all local applicant documents
        let localApplicants = [];
        try {
            localApplicants = await applicant_model_js_1.ApplicantModel.find().sort({ createdAt: -1 });
        }
        catch (localAppErr) {
            logger_js_1.logger.error('[RecruitmentController] Failed to fetch local applicants', { error: localAppErr.message });
        }
        // 3. Fetch all external applicants from AWS API
        let externalApplicants = [];
        try {
            const extRes = await fetch('https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants');
            if (extRes.ok) {
                const extData = await extRes.json();
                if (extData && Array.isArray(extData.data)) {
                    externalApplicants = extData.data;
                    logger_js_1.logger.info(`[RecruitmentController] Successfully fetched ${externalApplicants.length} external applicants from AWS`);
                }
            }
        }
        catch (extAppErr) {
            logger_js_1.logger.error('[RecruitmentController] Failed to fetch external applicants from AWS', { error: extAppErr.message });
        }
        // Load global roundsNeeded settings and deletedExternalIds
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        let roundsNeeded = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];
        let deletedExternalIds = [];
        if (orgId) {
            const template = await OfferTemplate_js_1.OfferTemplate.findOne({ organizationId: orgId });
            if (template) {
                if (template.roundsNeeded && template.roundsNeeded.length > 0) {
                    roundsNeeded = template.roundsNeeded;
                }
                if (template.deletedExternalIds && template.deletedExternalIds.length > 0) {
                    deletedExternalIds = template.deletedExternalIds.map((id) => id.toString());
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
            ...localCandidates.filter((c) => !deletedSet.has(c._id.toString())),
            ...mappedApplicants
        ];
        res.status(200).json({ success: true, candidates, roundsNeeded });
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
        const candidate = await findOrCreateCandidate(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        candidate.stage = stage;
        await candidate.save();
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
        let candidate = await findOrCreateCandidate(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        Object.assign(candidate, req.body);
        await candidate.save();
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
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        const candidate = await Candidate_js_1.Candidate.findByIdAndDelete(id);
        const applicant = await applicant_model_js_1.ApplicantModel.findByIdAndDelete(id);
        // Blacklist this ID so it won't reappear from external AWS source
        if (orgId) {
            await OfferTemplate_js_1.OfferTemplate.findOneAndUpdate({ organizationId: orgId }, { $addToSet: { deletedExternalIds: id.toString() } }, { upsert: false } // Only add to existing templates
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
                logger_js_1.logger.info(`[RecruitmentController] Successfully deleted external applicant ${id}`);
            }
        }
        catch (extErr) {
            logger_js_1.logger.error('[RecruitmentController] External applicant deletion failed/skipped', { error: extErr.message });
        }
        if (!candidate && !applicant && !externalDeleted) {
            logger_js_1.logger.warn(`[RecruitmentController] Candidate/Applicant ${id} not found locally or externally. Proceeding with UI clearing.`);
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
        const candidate = await findOrCreateCandidate(id);
        if (!candidate) {
            res.status(404).json({ success: false, message: 'Candidate not found' });
            return;
        }
        const { date, candidateName, address, appliedRole, duration, startDate, endDate, stipendDetails, technologies, footerPhone, footerEmail, footerWebsite, footerAddress, bodyText, signatoryName, signatoryTitle, pdfTitle, pdfSubject, emailSubject, emailBody, customPdfUrl, customPdfBase64, customPdfName, salaryOffered = 0 } = req.body;
        let pdfBuffer;
        let uploadedUrl;
        let fileName;
        if (customPdfBase64) {
            logger_js_1.logger.info(`[RecruitmentController] Using custom base64 PDF offer letter: ${customPdfName}`);
            fileName = customPdfName || `Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`;
            try {
                pdfBuffer = Buffer.from(customPdfBase64, 'base64');
                uploadedUrl = await (0, s3_js_1.uploadFileToS3)(pdfBuffer, fileName, 'application/pdf');
                logger_js_1.logger.info(`[RecruitmentController] Custom PDF uploaded successfully: ${uploadedUrl}`);
            }
            catch (uploadErr) {
                logger_js_1.logger.error('[RecruitmentController] Failed to process/upload custom PDF base64', { error: uploadErr.message });
                throw new Error(`Failed to upload custom PDF offer letter: ${uploadErr.message}`);
            }
        }
        else if (customPdfUrl) {
            logger_js_1.logger.info(`[RecruitmentController] Using custom uploaded PDF offer letter URL for ${candidateName}: ${customPdfUrl}`);
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
            offerLetterBase64: pdfBuffer.toString('base64'),
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
        // Fetch Organization Custom Microsoft OAuth2 Credentials from DB if available
        const orgId = req.user?.organizationId;
        let microsoftCredentials;
        if (orgId) {
            try {
                const authConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
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
                    logger_js_1.logger.info(`[RecruitmentController] Found active Microsoft Organization Auth Config for orgId: ${orgId}. Using dynamic credentials.`);
                }
            }
            catch (err) {
                logger_js_1.logger.error('[RecruitmentController] Failed to query OrganizationAuthConfig', { error: err.message });
            }
        }
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
                ],
                microsoftCredentials
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
            if (!template.roundsNeeded || template.roundsNeeded.length === 0) {
                template.roundsNeeded = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];
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
const getCandidateOfferLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const candidate = await Candidate_js_1.Candidate.findById(id);
        if (!candidate || !candidate.offerDetails) {
            res.status(404).json({ success: false, message: 'Offer details not found for this candidate.' });
            return;
        }
        let pdfBuffer;
        if (candidate.offerDetails.offerLetterBase64) {
            pdfBuffer = Buffer.from(candidate.offerDetails.offerLetterBase64, 'base64');
        }
        else if (candidate.offerDetails.offerLetterUrl) {
            logger_js_1.logger.info(`[RecruitmentController] Fetching offer letter PDF from URL for download fallback: ${candidate.offerDetails.offerLetterUrl}`);
            try {
                pdfBuffer = await (0, s3_js_1.fetchFileBuffer)(candidate.offerDetails.offerLetterUrl);
            }
            catch (fetchErr) {
                logger_js_1.logger.error('[RecruitmentController] Fallback fetch failed', { error: fetchErr.message });
                res.status(500).json({ success: false, message: `Failed to download offer letter PDF: ${fetchErr.message}` });
                return;
            }
        }
        else {
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
    }
    catch (error) {
        logger_js_1.logger.error('[RecruitmentController] getCandidateOfferLetter error', { error });
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCandidateOfferLetter = getCandidateOfferLetter;
