import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { Meeting } from '../models/Meeting.js';
import { createTeamsMeeting, cancelTeamsMeeting } from '../services/teamsMeeting.service.js';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { getIO } from '../sockets/socketHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Helper to fetch Microsoft credentials from organization config if available.
 */
const getOrgMicrosoftCredentials = async (orgId?: string) => {
  if (!orgId) return undefined;
  try {
    const authConfig = await OrganizationAuthConfig.findOne({
      organizationId: orgId,
      provider: 'MICROSOFT',
      isEnabled: true,
    });
    if (authConfig?.tenantId && authConfig?.clientId && authConfig?.clientSecret) {
      return {
        tenantId: authConfig.tenantId,
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret,
      };
    }
  } catch (err: any) {
    logger.error('[MeetingController] Failed to query OrganizationAuthConfig', { error: err.message });
  }
  return undefined;
};

/**
 * POST /api/meetings - Schedule a new Teams meeting
 */
export const scheduleMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id;
    const orgId = authReq.user?.organizationId;

    const {
      title,
      meetingType,
      startDateTime,
      endDateTime,
      attendees = [],
      candidateId,
      projectId,
      description,
      notes,
    } = req.body;

    if (!title || !meetingType || !startDateTime || !endDateTime) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: title, meetingType, startDateTime, endDateTime',
      });
      return;
    }

    const microsoftCredentials = await getOrgMicrosoftCredentials(orgId);

    // Create Teams meeting via Graph API
    const teamsMeeting = await createTeamsMeeting({
      subject: title,
      startDateTime,
      endDateTime,
      attendees: attendees.map((a: any) => ({ name: a.name, email: a.email })),
      meetingType,
      microsoftCredentials,
      description,
    });

    // Persist meeting record
    const meeting = new Meeting({
      organizationId: orgId,
      title,
      meetingType,
      teamsJoinUrl: teamsMeeting.joinUrl,
      teamsMeetingId: teamsMeeting.meetingId,
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
      organizer: process.env.SMTP_USER || 'suseendrakumar@ethicsecur.co.in',
      attendees,
      candidateId: candidateId || undefined,
      projectId: projectId || undefined,
      description,
      notes,
      status: 'SCHEDULED',
      createdBy: userId,
    });

    await meeting.save();



    // Emit real-time event
    getIO()?.emit('meeting_scheduled', {
      meeting,
      joinUrl: teamsMeeting.joinUrl,
    });

    logger.info(`[MeetingController] Meeting scheduled: ${title} (${meetingType})`);

    res.status(201).json({
      success: true,
      message: 'Teams meeting scheduled successfully',
      data: {
        meeting,
        joinUrl: teamsMeeting.joinUrl,
      }
    });
  } catch (error: any) {
    logger.error('[MeetingController] scheduleMeeting error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/meetings - List meetings with optional filters
 */
export const getMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const orgId = authReq.user?.organizationId;

    const { meetingType, status, startDate, endDate, page = 1, limit = 50 } = req.query;

    const filter: any = {};
    if (orgId) filter.organizationId = orgId;
    if (meetingType) filter.meetingType = meetingType;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.startDateTime = {};
      if (startDate) filter.startDateTime.$gte = new Date(startDate as string);
      if (endDate) filter.startDateTime.$lte = new Date(endDate as string);
    }

    // For general employees (EMPLOYEE role), restrict list to only meetings they are involved in
    if (authReq.user?.role === 'EMPLOYEE') {
      const userEmail = authReq.user?.email;
      const userId = authReq.user?.id;
      if (userEmail && userId) {
        filter.$or = [
          { createdBy: userId },
          { 'attendees.email': userEmail }
        ];
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [meetings, total] = await Promise.all([
      Meeting.find(filter)
        .sort({ startDateTime: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('candidateId', 'firstName lastName email appliedRole')
        .populate('projectId', 'name')
        .populate('createdBy', 'name email'),
      Meeting.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      meetings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    logger.error('[MeetingController] getMeetings error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/meetings/:id - Get single meeting details
 */
export const getMeetingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('candidateId', 'firstName lastName email appliedRole')
      .populate('projectId', 'name')
      .populate('createdBy', 'name email');

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }

    res.status(200).json({ success: true, meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/meetings/:id - Update meeting details (notes, status, attendees)
 */
export const updateMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );

    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }

    getIO()?.emit('meeting_updated', meeting);

    res.status(200).json({ success: true, meeting });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Helper to send cancellation email to all meeting attendees.
 */
const sendCancellationEmails = async (meeting: any): Promise<void> => {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    logger.warn('[MeetingController] SMTP credentials not set — skipping cancellation emails.');
    return;
  }

  const attendeeEmails: string[] = (
    Array.isArray(meeting.attendees) ? meeting.attendees : []
  )
    .map((a: any) => a?.email)
    .filter(Boolean);

  if (attendeeEmails.length === 0) {
    logger.info('[MeetingController] No attendees to notify for cancellation.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { ciphers: 'SSLv3' },
  });

  const startIST = new Date(meeting.startDateTime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Cancelled</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Figtree',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header with brand gradient -->
        <tr>
          <td style="background:linear-gradient(135deg,#ff6b00 0%,#e53e3e 60%,#7c3aed 100%);padding:32px 36px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Meeting Cancelled</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">EthicSecur HRMS Notification</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">We regret to inform you that the following meeting has been <strong style="color:#dc2626;">cancelled</strong>:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e5e7eb;padding:20px;margin-bottom:24px;">
              <tr><td style="padding:8px 0;">
                <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Meeting Title</span><br>
                <span style="font-size:18px;color:#111827;font-weight:700;">${meeting.title}</span>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Type</span><br>
                <span style="font-size:14px;color:#374151;font-weight:500;">${meeting.meetingType.replace('_', ' ')}</span>
              </td></tr>
              <tr><td style="padding:8px 0;border-top:1px solid #e5e7eb;">
                <span style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Originally Scheduled</span><br>
                <span style="font-size:14px;color:#374151;font-weight:500;">${startIST} IST</span>
              </td></tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.5;">If you have any questions regarding this cancellation, please reach out to the HR department or the meeting organizer.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 36px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">EthicSecur HRMS &bull; This is an automated notification, please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  const emailPromises = attendeeEmails.map((email) =>
    transporter.sendMail({
      from: `"EthicSecur HRMS" <${smtpUser}>`,
      to: email,
      subject: `❌ Meeting Cancelled: ${meeting.title}`,
      html: htmlBody,
    }).catch((err: any) => {
      logger.warn(`[MeetingController] Failed to send cancellation email to ${email}: ${err.message}`);
    })
  );

  await Promise.allSettled(emailPromises);
  logger.info(`[MeetingController] Cancellation emails sent to ${attendeeEmails.length} attendee(s).`);
};

/**
 * DELETE /api/meetings/:id - Cancel a meeting (creator-only)
 */
export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id;
    const orgId = authReq.user?.organizationId;

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      res.status(404).json({ success: false, message: 'Meeting not found' });
      return;
    }

    // Only the creator (or admin) can cancel the meeting
    const isCreator = meeting.createdBy?.toString() === userId?.toString();
    const isAdmin = authReq.user?.role === 'ADMIN' || authReq.user?.role === 'HR';
    if (!isCreator && !isAdmin) {
      res.status(403).json({ success: false, message: 'Only the meeting organizer can cancel this meeting.' });
      return;
    }

    // Cancel on Teams side
    try {
      const microsoftCredentials = await getOrgMicrosoftCredentials(orgId);
      await cancelTeamsMeeting(
        meeting.teamsMeetingId,
        meeting.organizer,
        microsoftCredentials
      );
    } catch (cancelErr: any) {
      logger.warn(`[MeetingController] Teams-side cancellation failed (proceeding with local cancel): ${cancelErr.message}`);
    }

    meeting.status = 'CANCELLED';
    await meeting.save();

    getIO()?.emit('meeting_cancelled', { meetingId: meeting._id });

    // Send cancellation emails to all attendees
    sendCancellationEmails(meeting).catch((err: any) => {
      logger.warn(`[MeetingController] Failed to send some cancellation emails: ${err.message}`);
    });

    res.status(200).json({ success: true, message: 'Meeting cancelled successfully' });
  } catch (error: any) {
    logger.error('[MeetingController] deleteMeeting error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Helper to format standard Date into Indian Standard Time (IST) string.
 */
const formatToIST = (date: Date): string => {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Helper to format minutes remaining into an elegant verbal duration (Days, Hours, Minutes).
 */
const formatRemainingTime = (totalMinutes: number): string => {
  if (totalMinutes <= 0) return '0 minutes';
  
  const days = Math.floor(totalMinutes / (24 * 60));
  const remainingMinutesAfterDays = totalMinutes % (24 * 60);
  const hours = Math.floor(remainingMinutesAfterDays / 60);
  const minutes = remainingMinutesAfterDays % 60;
  
  const segments: string[] = [];
  if (days > 0) {
    segments.push(`${days} day${days > 1 ? 's' : ''}`);
  }
  if (hours > 0) {
    segments.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }
  if (minutes > 0 || segments.length === 0) {
    segments.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }
  
  if (segments.length === 1) return segments[0];
  if (segments.length === 2) return `${segments[0]} and ${segments[1]}`;
  return `${segments.slice(0, -1).join(', ')}, and ${segments[segments.length - 1]}`;
};

/**
 * EthicSecur company logo as base64 PNG data URI — embedded so it works on any server without
 * requiring a static file host. Generated from /client/src/assets/ES_Logo.png.
 */
const ES_LOGO_B64 =
  'data:image/png;base64,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';

/**
 * Helper to generate a premium branded HTML template for meeting gate status screens.
 * Matches EthicSecur product theme: orange/red gradient, Figtree font, company logo.
 */
const getHtmlTemplate = (options: {
  title: string;
  status: 'warning' | 'error' | 'info';
  icon: string;
  description: string;
  countdownHtml?: string;
  detailsHtml?: string;
  footerText: string;
}): string => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title} | EthicSecur HRMS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-from: #0a0a0a;
      --bg-via: #1a0a00;
      --bg-to: #0a0014;
      --primary: hsl(21.5, 93.7%, 50.4%);
      --primary-dark: hsl(21.5, 93.7%, 38%);
      --primary-glow: rgba(236, 115, 15, 0.25);
      --card-bg: rgba(18, 10, 4, 0.75);
      --card-border: rgba(236, 115, 15, 0.12);
      --text-primary: #f8fafc;
      --text-secondary: #9ca3af;
      --warning-color: #fb923c;
      --warning-glow: rgba(251, 146, 60, 0.2);
      --error-color: #f87171;
      --error-glow: rgba(248, 113, 113, 0.2);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Figtree', sans-serif;
      background: radial-gradient(ellipse at top right, #2a0f00 0%, #0a0a0a 40%, #0a0014 80%, #000000 100%);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow-x: hidden;
      position: relative;
    }

    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background:
        radial-gradient(ellipse 600px 400px at 80% 10%, rgba(236, 115, 15, 0.08) 0%, transparent 70%),
        radial-gradient(ellipse 400px 600px at 10% 80%, rgba(124, 58, 237, 0.06) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      max-width: 560px;
      width: 100%;
    }

    /* Brand header */
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 24px;
    }

    .brand-logo-img {
      width: 36px;
      height: 36px;
      object-fit: contain;
      filter: drop-shadow(0 0 8px rgba(236,115,15,0.4));
    }

    .brand-name {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
      background: linear-gradient(135deg, #ec730f 0%, #ff9a4f 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 40px 32px;
      text-align: center;
      box-shadow:
        0 0 0 1px rgba(236,115,15,0.06),
        0 24px 48px -12px rgba(0,0,0,0.6),
        inset 0 1px 0 rgba(255,255,255,0.06);
      position: relative;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #ec730f 0%, #ff6b6b 50%, #7c3aed 100%);
      border-radius: 24px 24px 0 0;
    }

    .card:hover {
      transform: translateY(-3px);
      box-shadow:
        0 0 0 1px rgba(236,115,15,0.1),
        0 32px 56px -12px rgba(0,0,0,0.7),
        inset 0 1px 0 rgba(255,255,255,0.08);
    }

    .icon-container {
      width: 88px;
      height: 88px;
      margin: 0 auto 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      animation: float 4s ease-in-out infinite;
    }

    .icon-container.warning {
      background: rgba(251, 146, 60, 0.1);
      border: 1px solid rgba(251, 146, 60, 0.25);
      box-shadow: 0 0 32px var(--warning-glow);
    }

    .icon-container.error {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.25);
      box-shadow: 0 0 32px var(--error-glow);
    }

    .icon-container.info {
      background: rgba(236, 115, 15, 0.1);
      border: 1px solid rgba(236, 115, 15, 0.25);
      box-shadow: 0 0 32px var(--primary-glow);
    }

    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }

    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 20%, #d1d5db 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .description {
      font-size: 15px;
      color: var(--text-secondary);
      line-height: 1.65;
      margin-bottom: 28px;
      font-weight: 400;
    }

    .description strong {
      color: #fb923c;
      font-weight: 600;
      -webkit-text-fill-color: #fb923c;
    }

    .highlight-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(236,115,15,0.12);
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 20px;
      text-align: left;
    }

    .highlight-box-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #ec730f;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .highlight-box-content {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .time-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      background: rgba(236,115,15,0.15);
      border: 1px solid rgba(236,115,15,0.3);
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #fb923c;
      margin-left: auto;
      letter-spacing: 0.5px;
    }

    .countdown-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin: 20px 0 24px;
    }

    .countdown-item {
      background: rgba(236,115,15,0.05);
      border: 1px solid rgba(236,115,15,0.12);
      border-radius: 12px;
      padding: 14px 8px;
      position: relative;
      overflow: hidden;
    }

    .countdown-item::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #ec730f, #ff6b6b);
      opacity: 0.6;
    }

    .countdown-val {
      font-size: 32px;
      font-weight: 800;
      color: #fb923c;
      line-height: 1;
    }

    .countdown-lbl {
      font-size: 10px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 6px;
      font-weight: 600;
    }

    .footer-note {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-top: 20px;
      padding-top: 18px;
      border-top: 1px solid rgba(255,255,255,0.05);
    }

    .sub-brand {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      font-weight: 500;
      color: rgba(156,163,175,0.5);
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Brand Header -->
    <div class="brand-header">
      <img src="${ES_LOGO_B64}" alt="EthicSecur" class="brand-logo-img">
      <span class="brand-name">EthicSecur HRMS</span>
    </div>

    <div class="card">
      <div class="icon-container ${options.status}">
        ${options.icon}
      </div>

      <h1>${options.title}</h1>

      <p class="description">
        ${options.description}
      </p>

      ${options.countdownHtml || ''}

      ${options.detailsHtml || ''}

      <div class="footer-note">
        ${options.footerText}
      </div>
    </div>

    <div class="sub-brand">Secure Meeting Access &bull; Powered by EthicSecur</div>
  </div>
</body>
</html>
  `;
};


/**
 * GET /api/meetings/join/:id - Public redirect to join the Teams meeting
 * Enforces that users can only join the meeting during the scheduled time window.
 */
export const joinMeetingRedirect = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findById(id);

    if (!meeting) {
      res.status(404).send(
        getHtmlTemplate({
          title: 'Meeting Not Found',
          status: 'error',
          icon: '📂',
          description: 'The requested meeting schedule could not be located in our system.',
          footerText: 'Please double-check the invitation link or contact the HR department if you believe this is an error.',
        })
      );
      return;
    }

    const now = new Date();
    const start = new Date(meeting.startDateTime);
    const end = new Date(meeting.endDateTime);

    // Allow joining 15 minutes before the start time, and up to the end time
    const allowedStart = new Date(start.getTime() - 15 * 60 * 1000);
    const allowedEnd = end;

    if (now < allowedStart) {
      const timeDiffMs = start.getTime() - now.getTime();
      const totalMinutes = Math.ceil(timeDiffMs / (60 * 1000));
      const readableRemaining = formatRemainingTime(totalMinutes);
      
      const days = Math.floor(totalMinutes / (24 * 60));
      const remainingMinutesAfterDays = totalMinutes % (24 * 60);
      const hours = Math.floor(remainingMinutesAfterDays / 60);
      const minutes = remainingMinutesAfterDays % 60;

      const countdownHtml = `
        <div class="countdown-grid">
          <div class="countdown-item">
            <div class="countdown-val">${days}</div>
            <div class="countdown-lbl">Day${days !== 1 ? 's' : ''}</div>
          </div>
          <div class="countdown-item">
            <div class="countdown-val">${hours}</div>
            <div class="countdown-lbl">Hour${hours !== 1 ? 's' : ''}</div>
          </div>
          <div class="countdown-item">
            <div class="countdown-val">${minutes}</div>
            <div class="countdown-lbl">Minute${minutes !== 1 ? 's' : ''}</div>
          </div>
        </div>
      `;

      const detailsHtml = `
        <div class="highlight-box">
          <div class="highlight-box-title">Scheduled Start</div>
          <div class="highlight-box-content">
            <span>${formatToIST(start)}</span>
            <span class="time-badge">IST</span>
          </div>
        </div>
      `;

      res.status(403).send(
        getHtmlTemplate({
          title: "It's Not Time Yet",
          status: 'warning',
          icon: '⏳',
          description: `You are trying to join too early. This meeting is scheduled to start in <strong>${readableRemaining}</strong>.`,
          countdownHtml,
          detailsHtml,
          footerText: 'You can join starting 15 minutes before the scheduled time.',
        })
      );
      return;
    }

    if (now > allowedEnd) {
      const detailsHtml = `
        <div class="highlight-box" style="border-left: 4px solid var(--error-color);">
          <div class="highlight-box-title" style="color: var(--error-color);">Scheduled End</div>
          <div class="highlight-box-content">
            <span>${formatToIST(end)}</span>
            <span class="time-badge" style="background: rgba(248, 113, 113, 0.15); border-color: rgba(248, 113, 113, 0.3); color: #fca5a5;">IST</span>
          </div>
        </div>
      `;

      res.status(403).send(
        getHtmlTemplate({
          title: 'Meeting Has Ended',
          status: 'error',
          icon: '❌',
          description: 'This meeting link has expired as the scheduled duration has already ended.',
          detailsHtml,
          footerText: 'If you need to reschedule, please contact the HR department.',
        })
      );
      return;
    }

    // Redirect to actual Teams join URL
    res.redirect(meeting.teamsJoinUrl);
  } catch (error: any) {
    logger.error('[MeetingController] joinMeetingRedirect error', { error: error.message });
    res.status(500).send(
      getHtmlTemplate({
        title: 'Error Occurred',
        status: 'error',
        icon: '⚠️',
        description: `Something went wrong trying to join the meeting: ${error.message}`,
        footerText: 'Please refresh the page or try again later.',
      })
    );
  }
};
