import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { Organization } from '../models/Organization.js';
import { logger } from '../utils/logger.js';

export interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  userPrincipalName: string;
}

/**
 * Retrieves the Microsoft OAuth credentials from the DB for the given organization.
 * If no organizationId is provided, falls back to the first active Microsoft configuration in the system.
 */
export const getOneDriveConfigForOrg = async (organizationId?: string): Promise<OneDriveConfig> => {
  let authConfig;
  
  if (organizationId) {
    authConfig = await OrganizationAuthConfig.findOne({
      organizationId,
      provider: 'MICROSOFT',
      isEnabled: true
    });
  } else {
    // Public/unauthenticated endpoint fallback: find the first active Microsoft provider config
    authConfig = await OrganizationAuthConfig.findOne({
      provider: 'MICROSOFT',
      isEnabled: true
    });
  }

  if (!authConfig || !authConfig.clientId || !authConfig.clientSecret || !authConfig.tenantId) {
    logger.error(`OneDrive/Microsoft credentials not configured in DB ${organizationId ? `for org: ${organizationId}` : '(global fallback)'}`);
    throw new Error('OneDrive credentials are not configured.');
  }

  // Retrieve UPN (User Principal Name/Email).
  // Priority: 1. Custom domain field in authConfig, 2. Admin Email from Organization settings, 3. Global fallback env variable.
  let userPrincipalName = authConfig.domain;
  
  if (!userPrincipalName) {
    const org = await Organization.findById(authConfig.organizationId);
    userPrincipalName = org?.settings?.adminEmail || process.env.MICROSOFT_USER_ID_OR_UPN;
  }

  if (!userPrincipalName) {
    logger.error(`No User Principal Name (UPN) found for OneDrive uploads`);
    throw new Error('OneDrive User Principal Name (UPN) could not be determined.');
  }

  return {
    tenantId: authConfig.tenantId,
    clientId: authConfig.clientId,
    clientSecret: authConfig.clientSecret, // Already decrypted via post-init hook!
    userPrincipalName,
  };
};
