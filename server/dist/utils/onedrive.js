"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSharingLink = exports.uploadFileToOneDrive = exports.getOneDriveAccessToken = void 0;
const onedrive_config_js_1 = require("../config/onedrive.config.js");
const logger_js_1 = require("./logger.js");
// In-memory token cache Map keyed by organizationId (or 'global' fallback)
const tokenCaches = new Map();
/**
 * Gets a valid Microsoft Graph access token using the Client Credentials Flow.
 * Caches the token in-memory and requests a new one only when close to expiry.
 */
const getOneDriveAccessToken = async (organizationId) => {
    const config = await (0, onedrive_config_js_1.getOneDriveConfigForOrg)(organizationId);
    const now = Date.now();
    const cacheKey = organizationId || 'global';
    const cached = tokenCaches.get(cacheKey);
    // If token is cached and has at least 5 minutes of validity left, reuse it
    if (cached && cached.expiresAt - now > 5 * 60 * 1000) {
        return cached.accessToken;
    }
    logger_js_1.logger.info(`[OneDrive Service] Requesting new access token from Azure AD for key: ${cacheKey}...`);
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
        logger_js_1.logger.error(`[OneDrive Service] Failed to retrieve access token for key: ${cacheKey}:`, errorBody);
        throw new Error(`Azure AD Auth Error: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    // Cache token
    tokenCaches.set(cacheKey, {
        accessToken: data.access_token,
        expiresAt: now + (data.expires_in * 1000),
    });
    logger_js_1.logger.info(`[OneDrive Service] New access token cached for key: ${cacheKey}`);
    return data.access_token;
};
exports.getOneDriveAccessToken = getOneDriveAccessToken;
/**
 * Uploads a file buffer to the organization's OneDrive under the specified path.
 * Supports routing to specific employee personal OneDrive if userEmail is provided.
 */
const uploadFileToOneDrive = async (organizationId, fileBuffer, fileName, mimeType, folder = 'uploads', userEmail) => {
    const accessToken = await (0, exports.getOneDriveAccessToken)(organizationId);
    const config = await (0, onedrive_config_js_1.getOneDriveConfigForOrg)(organizationId);
    // Determine the target UPN: specific employee email or default admin service account UPN
    const targetUpn = userEmail || config.userPrincipalName;
    // Clean filename to prevent path traversal
    const safeFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    // Construct user drive upload endpoint:
    // PUT /users/{id-or-upn}/drive/root:/{folder}/{filename}:/content
    const uploadUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUpn)}/drive/root:/${folder}/${safeFileName}:/content`;
    logger_js_1.logger.info(`[OneDrive Service] Uploading file to path: ${folder}/${safeFileName} in OneDrive of user: ${targetUpn}`);
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': mimeType,
        },
        body: fileBuffer,
    });
    if (!response.ok) {
        const errorBody = await response.text();
        logger_js_1.logger.error(`[OneDrive Service] Upload failed for user ${targetUpn}:`, errorBody);
        throw new Error(`OneDrive Upload Error: ${response.statusText} (${response.status})`);
    }
    const fileData = await response.json();
    return {
        fileId: fileData.id,
        fileName: fileData.name,
        size: fileData.size,
    };
};
exports.uploadFileToOneDrive = uploadFileToOneDrive;
/**
 * Generates an anonymous, public sharing link for a OneDrive driveItem.
 */
const generateSharingLink = async (organizationId, fileId, userEmail) => {
    const accessToken = await (0, exports.getOneDriveAccessToken)(organizationId);
    const config = await (0, onedrive_config_js_1.getOneDriveConfigForOrg)(organizationId);
    const targetUpn = userEmail || config.userPrincipalName;
    const shareUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetUpn)}/drive/items/${fileId}/createLink`;
    logger_js_1.logger.info(`[OneDrive Service] Generating public sharing link for file ID: ${fileId} in OneDrive of user: ${targetUpn}`);
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
        logger_js_1.logger.error(`[OneDrive Service] Failed to create sharing link for user ${targetUpn}:`, errorBody);
        throw new Error(`OneDrive Share Link Error: ${response.statusText} (${response.status})`);
    }
    const data = await response.json();
    return data.link.webUrl;
};
exports.generateSharingLink = generateSharingLink;
