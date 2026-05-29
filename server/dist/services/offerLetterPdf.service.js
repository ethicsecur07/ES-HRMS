"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOfferLetterPdf = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const stream_1 = require("stream");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_js_1 = require("../utils/logger.js");
/**
 * Formats date from YYYY-MM-DD to DD/MM/YYYY for the offer letter
 */
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
/**
 * Generates a high-quality branded Offer Letter PDF using PDFKit vector graphics.
 */
const generateOfferLetterPdf = async (params) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit_1.default({ margin: 50, size: 'A4' });
            const buffers = [];
            const stream = new stream_1.PassThrough();
            stream.on('data', (chunk) => buffers.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(buffers)));
            stream.on('error', (err) => reject(err));
            doc.pipe(stream);
            // ==========================================
            // TOP HEADER BRANDING
            // ==========================================
            // 1. Organization Logo (Top Left)
            const logoPath = path_1.default.resolve(process.cwd(), '../client/src/assets/ES_Logo.png');
            if (fs_1.default.existsSync(logoPath)) {
                doc.image(logoPath, 50, 40, { width: 55 });
            }
            else {
                // Draw elegant fallback vector logo if file is missing
                doc.fillColor('#E74C3C').circle(75, 65, 20).fill();
                doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('ES', 65, 58);
            }
            // 2. Premium Top Right Polygon Banner (Red/Orange Diagonal)
            // Coordinates for a modern styled banner
            doc.save();
            // Draw background orange polygon
            doc.moveTo(330, 40)
                .lineTo(545, 40)
                .lineTo(545, 80)
                .lineTo(395, 80)
                .closePath();
            doc.fillColor('#D35400').fill();
            // Draw white diagonal accent line
            doc.moveTo(320, 40)
                .lineTo(327, 40)
                .lineTo(392, 80)
                .lineTo(385, 80)
                .closePath();
            doc.fillColor('#E74C3C').fill();
            doc.restore();
            // 3. Text on top-right banner
            doc.fillColor('#FFFFFF')
                .fontSize(9.5)
                .font('Helvetica-Bold')
                .text('ES EthicSecur SofTec Pvt Ltd', 400, 55, { align: 'right', width: 130 });
            // Reset cursor x coordinate back to left margin to prevent text squishing
            doc.x = 50;
            doc.y = 120; // Set y coordinate explicitly to start cleanly below the header banner
            // Reset text styling
            doc.fillColor('#2C3E50');
            // ==========================================
            // TITLE & RECIPIENT
            // ==========================================
            // Title
            doc.font('Helvetica-Bold')
                .fontSize(14)
                .text(params.pdfTitle || 'Internship Offer Letter', { align: 'center', underline: false });
            doc.moveDown(2);
            // Date & "TO," block
            doc.fontSize(10.5).font('Helvetica-Bold');
            doc.text(`DATE: ${formatDateStr(params.date)}`);
            doc.moveDown(1.2);
            doc.text('TO,');
            doc.moveDown(0.5);
            doc.font('Helvetica');
            // Recipient details (Name & Address block)
            doc.font('Helvetica-Bold').text(params.candidateName);
            if (params.candidateEmail) {
                doc.font('Helvetica-Bold').text('Email: ', { continued: true })
                    .font('Helvetica').text(params.candidateEmail);
            }
            doc.font('Helvetica');
            doc.text(params.address, { lineGap: 3, width: 350 });
            doc.moveDown(1.5);
            // PDF Subject line (optional)
            if (params.pdfSubject) {
                doc.font('Helvetica-Bold').text(params.pdfSubject);
                doc.moveDown(1.5);
            }
            // Salutation
            // Check if body already has 'Dear' to prevent duplicate salutations
            const bodyStartsWithDear = (params.bodyText || '').trim().toLowerCase().startsWith('dear');
            if (!bodyStartsWithDear) {
                doc.font('Helvetica-Bold').text(`Dear ${params.candidateName},`);
                doc.moveDown(1);
            }
            // ==========================================
            // BODY TEXT
            // ==========================================
            doc.font('Helvetica').fontSize(10.2);
            const defaultBodyText = `We are pleased to offer you the position of ${params.appliedRole} at ES EthicSecur SofTec for a period of ${params.duration}, starting from ${formatDateStr(params.startDate)}. This is a ${params.stipendDetails} designed to provide practical exposure to real-time web application development and industry-level projects.

During the internship, you will work with technologies including ${params.technologies}, along with frontend and backend development tasks, debugging, testing, and project support under the guidance of our technical team. You are expected to maintain professionalism, confidentiality, and follow company policies throughout the internship period.

We look forward to welcoming you to our team and are confident that your skills and dedication will make a valuable contribution to ES EthicSecur SofTec Pvt Ltd. Please confirm your acceptance of this offer by signing and returning a copy of this letter.`;
            const paragraphs = (params.bodyText || defaultBodyText).split('\n\n');
            paragraphs.forEach((p) => {
                if (p.trim()) {
                    // Replace all whitespace sequences (newlines, tabs, multiple spaces) with a single space to avoid word-stretching spacing bugs in justified text
                    const cleanParagraph = p.trim().replace(/\s+/g, ' ');
                    doc.text(cleanParagraph, {
                        align: 'justify',
                        lineGap: 4,
                        paragraphGap: 10
                    });
                }
            });
            doc.moveDown(1.5);
            // ==========================================
            // SIGNATURE BLOCK
            // ==========================================
            const signY = doc.y;
            // Left: Authorized Signatory
            doc.font('Helvetica-Bold').fontSize(10).text('Authorized Signatory', 50, signY);
            // Draw the actual signature image if it exists, otherwise fall back to vector drawing
            const signImagePath = path_1.default.resolve(process.cwd(), '../client/src/assets/ES_Sign.png');
            if (fs_1.default.existsSync(signImagePath)) {
                doc.image(signImagePath, 50, signY + 6, { height: 45 });
            }
            else {
                // Draw a simulated premium signature in blue ink using curved bezier vectors
                doc.save();
                doc.strokeColor('#1F618D').lineWidth(1.5);
                doc.moveTo(60, signY + 22)
                    .bezierCurveTo(75, signY + 5, 95, signY + 35, 110, signY + 12)
                    .bezierCurveTo(118, signY + 3, 125, signY + 22, 138, signY + 18)
                    .bezierCurveTo(145, signY + 15, 155, signY + 8, 160, signY + 25)
                    .stroke();
                doc.restore();
            }
            // Signatory Details
            doc.font('Helvetica').fontSize(9)
                .text(params.signatoryTitle || 'HR Department', 50, signY + 38)
                .font('Helvetica-Bold')
                .text(params.signatoryName || 'ES EthicSecur SofTec Private Limited', 50, signY + 50);
            // Right: Candidate Signature
            doc.font('Helvetica-Bold').fontSize(10)
                .text('CANDIDATE SIGNATURE', 380, signY, { align: 'right', width: 165 });
            // ==========================================
            // BOTTOM FOOTER BRANDING & DETAILS
            // ==========================================
            // Let's place the footer at the very bottom of the page
            const footerY = doc.page.height - 95;
            // 1. Double border lines
            doc.strokeColor('#BDC3C7').lineWidth(0.8)
                .moveTo(50, footerY)
                .lineTo(545, footerY)
                .stroke();
            doc.strokeColor('#E67E22').lineWidth(1.2)
                .moveTo(50, footerY + 2.5)
                .lineTo(545, footerY + 2.5)
                .stroke();
            // 2. Contact details (Icons placeholder / text)
            doc.fillColor('#7F8C8D').fontSize(8.5).font('Helvetica');
            const phone = params.footerPhone || '755028487';
            const email = params.footerEmail || 'info@ethicsecur.com';
            const website = params.footerWebsite || 'www.ethicsecur.com';
            const address = params.footerAddress || '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004';
            doc.text(`Phone: ${phone}      |      Email: ${email}      |      Website: ${website}`, 50, footerY + 12, { align: 'center' });
            doc.fillColor('#2C3E50').font('Helvetica-Bold')
                .text('ES EthicSecur SofTec Pvt Ltd', 50, footerY + 26, { align: 'center' });
            doc.fillColor('#7F8C8D').font('Helvetica').fontSize(7)
                .text(address, 50, footerY + 38, { align: 'center', width: 495, lineBreak: false, ellipsis: true });
            // 3. Colorful bottom border strip
            doc.save();
            doc.rect(50, doc.page.height - 35, 495, 5).fillColor('#D35400').fill();
            doc.restore();
            doc.end();
        }
        catch (error) {
            logger_js_1.logger.error('[OfferLetterPdfService] Failed to generate PDF', { error });
            reject(error);
        }
    });
};
exports.generateOfferLetterPdf = generateOfferLetterPdf;
