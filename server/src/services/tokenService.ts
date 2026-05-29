import { logger } from '../utils/logger.js';

/**
 * Fetches a fresh Microsoft OAuth2 Access Token using Client Credentials Flow.
 * Used to authenticate secure SMTP AUTH client submissions via suseendrakumar@ethicsecur.co.in.
 */
export const getMicrosoftAccessToken = async (scope: string = 'https://graph.microsoft.com/.default'): Promise<string> => {
  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET } = process.env;

  const isPlaceholder = (val: string | undefined) => {
    if (!val) return true;
    const lower = val.trim().toLowerCase();
    return (
      lower === '' ||
      lower.includes('your_microsoft_') ||
      lower.includes('your_app_') ||
      lower.includes('placeholder') ||
      lower.includes('tenant_id') ||
      lower.includes('client_id') ||
      lower.includes('client_secret')
    );
  };

  if (
    !TENANT_ID || !CLIENT_ID || !CLIENT_SECRET ||
    isPlaceholder(TENANT_ID) || isPlaceholder(CLIENT_ID) || isPlaceholder(CLIENT_SECRET)
  ) {
    throw new Error('Microsoft OAuth2 settings are unconfigured placeholders or incomplete in the server .env file. Please configure TENANT_ID, CLIENT_ID, and CLIENT_SECRET with real Azure AD details.');
  }

  try {
    const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('scope', scope);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorResponse = await response.text();
      throw new Error(`Microsoft Graph OAuth token request failed: ${response.statusText} - ${errorResponse}`);
    }

    const data = await response.json() as { access_token: string };
    if (!data.access_token) {
      throw new Error('Microsoft Graph OAuth token response did not contain access_token');
    }

    return data.access_token;
  } catch (error: any) {
    logger.error('[TokenService] Failed to retrieve Microsoft Access Token', { error: error.message });
    throw error;
  }
};
