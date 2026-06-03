import { getMicrosoftAccessToken } from './tokenService.js';
import { logger } from '../utils/logger.js';

const { SMTP_USER = 'suseendrakumar@ethicsecur.co.in' } = process.env;

export interface TeamsAttendee {
  name: string;
  email: string;
}

export interface CreateMeetingOptions {
  subject: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  attendees: TeamsAttendee[];
  meetingType: 'INTERVIEW' | 'CLIENT' | 'TEAM';
  organizerEmail?: string; // defaults to SMTP_USER
  microsoftCredentials?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
  description?: string;
}

export interface TeamsMeetingResult {
  joinUrl: string;
  meetingId: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
}

/**
 * Helper to resolve a user UPN/email to their Microsoft Graph GUID Object ID.
 * Graph API onlineMeetings endpoints require the user Object ID (GUID) rather than UPN.
 */
export const resolveUserId = async (graphToken: string, email: string): Promise<string> => {
  const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
  if (isGuid) return email;

  try {
    const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}`;
    const res = await fetch(userUrl, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        logger.info(`[TeamsMeetingService] Resolved UPN ${email} to Object ID ${data.id}`);
        return data.id;
      }
    } else {
      const errText = await res.text();
      logger.warn(`[TeamsMeetingService] Failed to resolve UPN ${email} to Object ID: ${res.status} ${errText}`);
    }
  } catch (err: any) {
    logger.warn(`[TeamsMeetingService] resolveUserId error for ${email}: ${err.message}`);
  }
  return email; // fallback to email if resolution fails
};

/**
 * Creates a Microsoft Teams Online Meeting via the Graph API.
 * Uses the client_credentials flow with an Application Access Policy
 * to create meetings on behalf of the organizer user.
 */
export const createTeamsMeeting = async (
  options: CreateMeetingOptions
): Promise<TeamsMeetingResult> => {
  const organizerEmail = options.organizerEmail || SMTP_USER;

  logger.info(`[TeamsMeetingService] Creating Teams meeting: "${options.subject}" on behalf of ${organizerEmail}`);

  try {
    const graphToken = await getMicrosoftAccessToken(
      'https://graph.microsoft.com/.default',
      options.microsoftCredentials
    );

    // Resolve organizer UPN/email to Object ID (GUID)
    const organizerId = await resolveUserId(graphToken, organizerEmail);

    // Try creating via Outlook Calendar Event first so it shows up in Teams Calendar!
    try {
      logger.info(`[TeamsMeetingService] Attempting to create Calendar Event for ${organizerEmail}`);
      const eventUrl = `https://graph.microsoft.com/v1.0/users/${organizerId}/events`;
      const eventBody = {
        subject: options.subject,
        body: options.description ? {
          contentType: 'html',
          content: options.description.replace(/\n/g, '<br/>'),
        } : undefined,
        start: {
          dateTime: options.startDateTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: options.endDateTime,
          timeZone: 'UTC',
        },
        attendees: options.attendees.map((a) => ({
          emailAddress: {
            address: a.email,
            name: a.name,
          },
          type: 'required',
        })),
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      };

      const eventResponse = await fetch(eventUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${graphToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });

      if (eventResponse.ok) {
        const eventData = await eventResponse.json();
        const joinUrl = eventData.onlineMeeting?.joinUrl || eventData.onlineMeeting?.joinWebUrl;
        if (joinUrl) {
          logger.info(`[TeamsMeetingService] Calendar Event with Teams link created successfully! Event ID: ${eventData.id}`);
          return {
            joinUrl,
            meetingId: eventData.onlineMeeting.id || eventData.id,
            subject: options.subject,
            startDateTime: options.startDateTime,
            endDateTime: options.endDateTime,
          };
        }
      }
      
      const errText = await eventResponse.text();
      logger.warn(`[TeamsMeetingService] Calendar Event creation failed (likely missing Calendars.ReadWrite permission). Falling back to onlineMeetings: ${eventResponse.status} ${errText}`);
    } catch (eventErr: any) {
      logger.warn(`[TeamsMeetingService] Calendar Event creation error: ${eventErr.message}. Falling back to onlineMeetings`);
    }

    // Fallback: Create onlineMeeting directly (does not put it on the calendar)
    const requestBody = {
      subject: options.subject,
      startDateTime: options.startDateTime,
      endDateTime: options.endDateTime,
      participants: {
        attendees: options.attendees.map((a) => ({
          upn: a.email,
          identity: {
            user: {
              displayName: a.name,
            },
          },
          role: 'attendee',
        })),
      },
      lobbyBypassSettings: {
        scope: 'everyone',
        isDialInBypassEnabled: true,
      },
      isEntryExitAnnounced: false,
    };

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${organizerId}/onlineMeetings`;

    const response = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[TeamsMeetingService] Graph API onlineMeetings failed: ${response.status} ${errorText}`);
      throw new Error(
        `Failed to create Teams meeting (${response.status}): ${errorText}. ` +
        `Ensure Application Access Policy is configured for app and user ${organizerEmail} (Object ID: ${organizerId}).`
      );
    }

    const data = await response.json();

    logger.info(`[TeamsMeetingService] Teams meeting created successfully. Join URL: ${data.joinUrl}`);

    return {
      joinUrl: data.joinUrl || data.joinWebUrl,
      meetingId: data.id,
      subject: data.subject,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
    };
  } catch (err: any) {
    logger.warn(
      `[TeamsMeetingService] Microsoft Graph onlineMeetings API failed (${err.message}). ` +
      `Generating functional Jitsi Meet fallback conference room instead.`
    );

    const cleanSubject = options.subject.replace(/[^a-zA-Z0-9]/g, '-') || 'Meeting';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const roomName = `EthicSecur-HRMS-${cleanSubject}-${randomSuffix}`;
    const fallbackJoinUrl = `https://meet.jit.si/${roomName}`;
    const fallbackMeetingId = `fallback-${Math.random().toString(36).substring(2, 10)}`;

    return {
      joinUrl: fallbackJoinUrl,
      meetingId: fallbackMeetingId,
      subject: options.subject,
      startDateTime: options.startDateTime,
      endDateTime: options.endDateTime,
    };
  }
};

/**
 * Cancels / deletes an existing Teams Online Meeting.
 */
export const cancelTeamsMeeting = async (
  meetingId: string,
  organizerEmail?: string,
  microsoftCredentials?: { tenantId: string; clientId: string; clientSecret: string }
): Promise<void> => {
  if (meetingId.startsWith('fallback-')) {
    logger.info(`[TeamsMeetingService] Skipping deletion for fallback meeting ${meetingId}`);
    return;
  }

  const organizer = organizerEmail || SMTP_USER;

  logger.info(`[TeamsMeetingService] Cancelling Teams meeting ${meetingId} for ${organizer}`);

  const graphToken = await getMicrosoftAccessToken(
    'https://graph.microsoft.com/.default',
    microsoftCredentials
  );

  const organizerId = await resolveUserId(graphToken, organizer);

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${organizerId}/onlineMeetings/${meetingId}`;

  const response = await fetch(graphUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${graphToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    logger.error(`[TeamsMeetingService] Failed to cancel meeting: ${response.status} ${errorText}`);
    throw new Error(`Failed to cancel Teams meeting (${response.status}): ${errorText}`);
  }

  logger.info(`[TeamsMeetingService] Meeting ${meetingId} cancelled successfully.`);
};

/**
 * Lists upcoming online meetings created by the organizer.
 */
export const listTeamsMeetings = async (
  organizerEmail?: string,
  microsoftCredentials?: { tenantId: string; clientId: string; clientSecret: string }
): Promise<any[]> => {
  const organizer = organizerEmail || SMTP_USER;

  const graphToken = await getMicrosoftAccessToken(
    'https://graph.microsoft.com/.default',
    microsoftCredentials
  );

  const organizerId = await resolveUserId(graphToken, organizer);

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${organizerId}/onlineMeetings`;

  const response = await fetch(graphUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${graphToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`[TeamsMeetingService] Failed to list meetings: ${response.status} ${errorText}`);
    throw new Error(`Failed to list Teams meetings: ${errorText}`);
  }

  const data = await response.json();
  return data.value || [];
};
