import { getOneDriveConfigForOrg } from '../config/onedrive.config.js';
import { logger } from './logger.js';

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

// In-memory token cache Map keyed by organizationId (or 'global' fallback)
const tokenCaches = new Map<string, TokenCache>();

/**
 * Gets a valid Microsoft Graph access token using the Client Credentials Flow.
 * Caches the token in-memory and requests a new one only when close to expiry.
 */
export const getOneDriveAccessToken = async (organizationId?: string): Promise<string> => {
  const config = await getOneDriveConfigForOrg(organizationId);
  const now = Date.now();
  const cacheKey = organizationId || 'global';

  const cached = tokenCaches.get(cacheKey);
  // If token is cached and has at least 5 minutes of validity left, reuse it
  if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
    return cached.accessToken;
  }

  logger.info(`[OneDrive Service] Requesting new access token from Azure AD for key: ${cacheKey}...`);

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', config.clientId);
  params.append('client_secret', config.clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`[OneDrive Service] Failed to retrieve access token for key: ${cacheKey}:`, errorBody);
    throw new Error(`Azure AD Auth Error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  
  // Cache token
  tokenCaches.set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in * 1000),
  });

  logger.info(`[OneDrive Service] New access token cached for key: ${cacheKey}`);
  return data.access_token;
};

/**
 * Uploads a file buffer to the organization's OneDrive under the specified path.
 * Supports routing to specific employee personal OneDrive if userEmail is provided.
 */
export const uploadFileToOneDrive = async (
  organizationId: string | undefined,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads',
  userEmail?: string
): Promise<{ fileId: string; fileName: string; size: number }> => {
  const accessToken = await getOneDriveAccessToken(organizationId);
  const config = await getOneDriveConfigForOrg(organizationId);

  // Determine the target UPN: specific employee email or default admin service account UPN
  const targetUpn = userEmail || config.userPrincipalName;

  // Clean filename to prevent path traversal
  const safeFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  // Construct user drive upload endpoint:
  // PUT /users/{id-or-upn}/drive/root:/{folder}/{filename}:/content
  const uploadUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    targetUpn
  )}/drive/root:/${folder}/${safeFileName}:/content`;

  logger.info(`[OneDrive Service] Uploading file to path: ${folder}/${safeFileName} in OneDrive of user: ${targetUpn}`);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': mimeType,
    },
    body: fileBuffer as any,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`[OneDrive Service] Upload failed for user ${targetUpn}:`, errorBody);
    throw new Error(`OneDrive Upload Error: ${response.statusText} (${response.status})`);
  }

  const fileData = await response.json();
  
  return {
    fileId: fileData.id,
    fileName: fileData.name,
    size: fileData.size,
  };
};

/**
 * Generates an anonymous, public sharing link for a OneDrive driveItem.
 */
export const generateSharingLink = async (
  organizationId: string | undefined,
  fileId: string,
  userEmail?: string
): Promise<string> => {
  const accessToken = await getOneDriveAccessToken(organizationId);
  const config = await getOneDriveConfigForOrg(organizationId);

  const targetUpn = userEmail || config.userPrincipalName;

  const shareUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    targetUpn
  )}/drive/items/${fileId}/createLink`;

  logger.info(`[OneDrive Service] Generating public sharing link for file ID: ${fileId} in OneDrive of user: ${targetUpn}`);

  const response = await fetch(shareUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'view',
      scope: 'anonymous', // Publicly accessible link
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`[OneDrive Service] Failed to create sharing link for user ${targetUpn}:`, errorBody);
    throw new Error(`OneDrive Share Link Error: ${response.statusText} (${response.status})`);
  }

  const data = await response.json();
  return data.link.webUrl;
};
