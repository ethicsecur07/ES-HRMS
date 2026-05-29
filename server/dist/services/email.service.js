"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_js_1 = require("../utils/logger.js");
const tokenService_js_1 = require("./tokenService.js");
const { SMTP_HOST = 'smtp.office365.com', SMTP_PORT = '587', SMTP_USER = 'suseendrakumar@ethicsecur.co.in', SMTP_PASS, TENANT_ID, CLIENT_ID, CLIENT_SECRET } = process.env;
/**
 * Dispatches an email using safe dynamic transporters:
 * - Uses secure Microsoft OAuth2 SMTP AUTH if Tenant ID, Client ID, Client Secret are set in .env.
 * - Uses traditional SMTP password AUTH if SMTP_PASS is set.
 * - Otherwise, operates in a safe console-log DRY-RUN mode.
 */
const sendEmail = async (options) => {
    try {
        let transporter;
        const isPlaceholder = (val) => {
            if (!val)
                return true;
            const lower = val.trim().toLowerCase();
            return (lower === '' ||
                lower.includes('your_microsoft_') ||
                lower.includes('your_app_') ||
                lower.includes('placeholder') ||
                lower.includes('tenant_id') ||
                lower.includes('client_id') ||
                lower.includes('client_secret'));
        };
        const hasOAuthCredentials = TENANT_ID && CLIENT_ID && CLIENT_SECRET &&
            !isPlaceholder(TENANT_ID) &&
            !isPlaceholder(CLIENT_ID) &&
            !isPlaceholder(CLIENT_SECRET);
        const hasSmtpPassword = SMTP_PASS && SMTP_PASS.trim() !== '';
        let isGraphSent = false;
        if (hasSmtpPassword) {
            logger_js_1.logger.info(`[EmailService] Using password-based SMTP AUTH for ${SMTP_USER}...`);
            transporter = nodemailer_1.default.createTransport({
                host: SMTP_HOST,
                port: Number(SMTP_PORT),
                secure: SMTP_PORT === '465', // true for 465, false for other ports
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
        }
        else if (hasOAuthCredentials) {
            logger_js_1.logger.info(`[EmailService] Attempting Microsoft Graph API sendMail...`);
            try {
                const graphToken = await (0, tokenService_js_1.getMicrosoftAccessToken)('https://graph.microsoft.com/.default');
                const graphAttachments = options.attachments?.map(att => ({
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: att.filename,
                    contentType: att.contentType || 'application/pdf',
                    contentBytes: att.content.toString('base64')
                })) || [];
                const sendMailPayload = {
                    message: {
                        subject: options.subject,
                        body: {
                            contentType: options.html ? 'HTML' : 'Text',
                            content: options.html || options.text
                        },
                        toRecipients: [
                            {
                                emailAddress: {
                                    address: options.to
                                }
                            }
                        ],
                        attachments: graphAttachments
                    },
                    saveToSentItems: 'true'
                };
                const graphUrl = `https://graph.microsoft.com/v1.0/users/${SMTP_USER}/sendMail`;
                const graphResponse = await fetch(graphUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${graphToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(sendMailPayload)
                });
                if (graphResponse.ok) {
                    logger_js_1.logger.info(`[EmailService] Email sent successfully via Microsoft Graph API.`);
                    isGraphSent = true;
                }
                else {
                    const errorText = await graphResponse.text();
                    logger_js_1.logger.warn(`[EmailService] Microsoft Graph API sendMail returned status ${graphResponse.status}: ${errorText}. Falling back to Nodemailer SMTP OAuth2...`);
                }
            }
            catch (graphError) {
                logger_js_1.logger.warn(`[EmailService] Microsoft Graph API sendMail failed: ${graphError.message || graphError}. Proceeding to fallback SMTP...`);
            }
            if (!isGraphSent) {
                logger_js_1.logger.info(`[EmailService] Attempting fallback to Microsoft OAuth2 SMTP AUTH token retrieval...`);
                const token = await (0, tokenService_js_1.getMicrosoftAccessToken)('https://outlook.office365.com/.default');
                transporter = nodemailer_1.default.createTransport({
                    host: SMTP_HOST,
                    port: Number(SMTP_PORT),
                    secure: false, // Office 365 STARTTLS
                    auth: {
                        type: 'OAuth2',
                        user: SMTP_USER,
                        accessToken: token
                    },
                    tls: {
                        ciphers: 'SSLv3',
                        rejectUnauthorized: false
                    }
                });
            }
        }
        else {
            logger_js_1.logger.warn('[EmailService] Microsoft Azure AD OAuth2 credentials are unconfigured or incomplete in .env. Operating in DRY-RUN mode.');
            transporter = {
                sendMail: async (mailOptions) => {
                    logger_js_1.logger.info(`[EmailService DRY-RUN] Dispatching to ${mailOptions.to}. Subject: ${mailOptions.subject}. (Transporter operates in dry-run)`);
                    return { messageId: 'dry-run-oauth2-id' };
                }
            };
        }
        if (!isGraphSent) {
            const mailOptions = {
                from: `"${SMTP_USER.split('@')[0]}" <${SMTP_USER}>`,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments
            };
            const info = await transporter.sendMail(mailOptions);
            logger_js_1.logger.info(`[EmailService] Email sent successfully via SMTP. Message ID: ${info.messageId}`);
        }
    }
    catch (error) {
        logger_js_1.logger.error('[EmailService] Failed to send email via Microsoft OAuth2 Services', { error: error.message || error, to: options.to });
        throw new Error(`Email delivery failed. \n` +
            `- Graph API attempt failed.\n` +
            `- Fallback SMTP AUTH attempt failed: ${error.message || error}\n\n` +
            `RECOMMENDED FIX:\n` +
            `1. In your Azure AD App Registration, grant 'Mail.Send' Application Permission under Microsoft Graph API and click 'Grant admin consent'. This uses Graph API to send directly and bypasses SMTP blocks.\n` +
            `2. Alternatively, ensure 'Authenticated SMTP' is enabled on the suseendrakumar@ethicsecur.co.in mailbox in M365 Admin Center.`);
    }
};
exports.sendEmail = sendEmail;
