"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMicrosoftAccessToken = void 0;
const logger_js_1 = require("../utils/logger.js");
/**
 * Fetches a fresh Microsoft OAuth2 Access Token using Client Credentials Flow.
 * Used to authenticate secure SMTP AUTH client submissions via suseendrakumar@ethicsecur.co.in.
 */
const getMicrosoftAccessToken = async (scope = 'https://graph.microsoft.com/.default', credentials) => {
    const tenantId = credentials?.tenantId || process.env.TENANT_ID;
    const clientId = credentials?.clientId || process.env.CLIENT_ID;
    const clientSecret = credentials?.clientSecret || process.env.CLIENT_SECRET;
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
    if (!tenantId || !clientId || !clientSecret ||
        isPlaceholder(tenantId) || isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
        throw new Error('Microsoft OAuth2 settings are unconfigured placeholders or incomplete in the configuration. Please configure TENANT_ID, CLIENT_ID, and CLIENT_SECRET with real Azure AD details.');
    }
    try {
        const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_secret', clientSecret);
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
        const data = await response.json();
        if (!data.access_token) {
            throw new Error('Microsoft Graph OAuth token response did not contain access_token');
        }
        return data.access_token;
    }
    catch (error) {
        logger_js_1.logger.error('[TokenService] Failed to retrieve Microsoft Access Token', { error: error.message });
        throw error;
    }
};
exports.getMicrosoftAccessToken = getMicrosoftAccessToken;
