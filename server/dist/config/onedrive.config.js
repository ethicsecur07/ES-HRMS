"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOneDriveConfigForOrg = void 0;
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
const Organization_js_1 = require("../models/Organization.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Retrieves the Microsoft OAuth credentials from the DB for the given organization.
 * If no organizationId is provided, falls back to the first active Microsoft configuration in the system.
 */
const getOneDriveConfigForOrg = async (organizationId) => {
    let authConfig;
    if (organizationId) {
        authConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId,
            provider: 'MICROSOFT',
            isEnabled: true
        });
    }
    else {
        // Public/unauthenticated endpoint fallback: find the first active Microsoft provider config
        authConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            provider: 'MICROSOFT',
            isEnabled: true
        });
    }
    if (!authConfig || !authConfig.clientId || !authConfig.clientSecret || !authConfig.tenantId) {
        logger_js_1.logger.error(`OneDrive/Microsoft credentials not configured in DB ${organizationId ? `for org: ${organizationId}` : '(global fallback)'}`);
        throw new Error('OneDrive credentials are not configured.');
    }
    // Retrieve UPN (User Principal Name/Email).
    // Priority: 1. Custom domain field in authConfig, 2. Admin Email from Organization settings, 3. Global fallback env variable.
    let userPrincipalName = authConfig.domain;
    if (!userPrincipalName) {
        const org = await Organization_js_1.Organization.findById(authConfig.organizationId);
        userPrincipalName = org?.settings?.adminEmail || process.env.MICROSOFT_USER_ID_OR_UPN;
    }
    if (!userPrincipalName) {
        logger_js_1.logger.error(`No User Principal Name (UPN) found for OneDrive uploads`);
        throw new Error('OneDrive User Principal Name (UPN) could not be determined.');
    }
    return {
        tenantId: authConfig.tenantId,
        clientId: authConfig.clientId,
        clientSecret: authConfig.clientSecret, // Already decrypted via post-init hook!
        userPrincipalName,
    };
};
exports.getOneDriveConfigForOrg = getOneDriveConfigForOrg;
