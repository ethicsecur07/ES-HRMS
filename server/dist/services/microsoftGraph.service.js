"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicrosoftGraphService = void 0;
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
// Map common Microsoft 365 SkuPartNumbers to friendly display names
const SKU_FRIENDLY_NAMES = {
    'ENTERPRISEPACK': 'Office 365 E3',
    'ENTERPRISEWITHOUTOUTLOOK': 'Office 365 E5',
    'STANDARDPACK': 'Office 365 E1',
    'SPE_E3': 'Microsoft 365 E3',
    'SPE_E5': 'Microsoft 365 E5',
    'DEVELOPERPACK_E5': 'Microsoft 365 E5 Developer',
    'O365_BUSINESS_PREMIUM': 'Microsoft 365 Business Premium',
    'SMB_BUSINESS_PREMIUM': 'Microsoft 365 Business Standard',
    'AAD_PREMIUM': 'Microsoft Entra ID P1 (Azure AD Premium P1)',
    'AAD_PREMIUM_P2': 'Microsoft Entra ID P2 (Azure AD Premium P2)',
};
class MicrosoftGraphService {
    /**
     * Acquires Microsoft Graph access token using client_credentials grant.
     */
    static async getAccessToken(orgId) {
        const msalConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId: orgId,
            provider: 'MICROSOFT',
            isEnabled: true,
        });
        if (!msalConfig) {
            throw new Error('Microsoft SSO configuration not found or is disabled for this organization.');
        }
        if (!msalConfig.clientId || !msalConfig.clientSecret) {
            throw new Error('Microsoft SSO configuration is missing Client ID or Client Secret.');
        }
        const tenantId = msalConfig.tenantId || 'common';
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: msalConfig.clientId,
                client_secret: msalConfig.clientSecret,
                scope: 'https://graph.microsoft.com/.default',
            }),
        });
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Failed to acquire Microsoft Graph token: ${errorText}`);
        }
        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
    }
    /**
     * Fetches available licenses from the Azure AD tenant.
     * If config is missing or live fetch fails, returns standard fallback placeholders.
     */
    static async getAvailableLicenses(orgId) {
        const fallbackLicenses = [
            { skuId: 'cbd2270f-1a1a-4254-8c1b-ae257e849924', skuPartNumber: 'O365_BUSINESS_PREMIUM', displayName: 'Microsoft 365 Business Premium', availableUnits: 25, consumedUnits: 0 },
            { skuId: 'f30b80d3-c05e-49b8-b4b3-d6c559777651', skuPartNumber: 'SMB_BUSINESS_PREMIUM', displayName: 'Microsoft 365 Business Standard', availableUnits: 25, consumedUnits: 0 },
            { skuId: '18181a0e-bcda-4ac3-a052-e22f16ee02f8', skuPartNumber: 'ENTERPRISEPACK', displayName: 'Office 365 E3', availableUnits: 25, consumedUnits: 0 },
            { skuId: 'c7df2785-449e-4de2-bfaa-434dbabd7d46', skuPartNumber: 'ENTERPRISEWITHOUTOUTLOOK', displayName: 'Office 365 E5', availableUnits: 25, consumedUnits: 0 },
            { skuId: '41781248-7f9e-4e4b-b463-547e70483a99', skuPartNumber: 'AAD_PREMIUM', displayName: 'Microsoft Entra ID P1', availableUnits: 100, consumedUnits: 0 },
        ];
        try {
            const msalConfig = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
                organizationId: orgId,
                provider: 'MICROSOFT',
                isEnabled: true,
            });
            if (!msalConfig) {
                return { isAzureConfigured: false, licenses: fallbackLicenses };
            }
            const accessToken = await this.getAccessToken(orgId);
            const response = await fetch('https://graph.microsoft.com/v1.0/subscribedSkus', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            if (!response.ok) {
                console.warn(`Failed to fetch live Azure licenses. Status: ${response.status}. Using placeholders.`);
                return { isAzureConfigured: true, licenses: fallbackLicenses };
            }
            const data = await response.json();
            const licenses = (data.value || []).map((sku) => {
                const friendlyName = SKU_FRIENDLY_NAMES[sku.skuPartNumber] || sku.skuPartNumber;
                const enabledUnits = sku.prepaidUnits?.enabled || 0;
                const consumed = sku.consumedUnits || 0;
                return {
                    skuId: sku.skuId,
                    skuPartNumber: sku.skuPartNumber,
                    displayName: friendlyName,
                    availableUnits: enabledUnits - consumed >= 0 ? enabledUnits - consumed : 0,
                    consumedUnits: consumed,
                };
            });
            return {
                isAzureConfigured: true,
                licenses: licenses.length > 0 ? licenses : fallbackLicenses,
            };
        }
        catch (err) {
            console.warn('Error fetching subscription SKUs, using fallbacks:', err.message);
            return { isAzureConfigured: false, licenses: fallbackLicenses };
        }
    }
    /**
     * Creates a user in Microsoft Azure Active Directory / Entra ID.
     */
    static async createUserInAzure(orgId, userData) {
        const accessToken = await this.getAccessToken(orgId);
        const payload = {
            accountEnabled: true,
            displayName: userData.displayName,
            givenName: userData.givenName,
            surname: userData.surname,
            mailNickname: userData.userPrincipalName.split('@')[0],
            userPrincipalName: userData.userPrincipalName,
            passwordProfile: {
                forceChangePasswordNextSignIn: true,
                password: userData.tempPassword || 'EthicSec@2026!',
            },
            jobTitle: userData.jobTitle || 'Employee',
            department: userData.department || 'Development',
        };
        const response = await fetch('https://graph.microsoft.com/v1.0/users', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = errorText;
            try {
                const jsonErr = JSON.parse(errorText);
                errorMsg = jsonErr.error?.message || errorText;
            }
            catch (_) { }
            throw new Error(`Failed to create Azure AD user account: ${errorMsg}`);
        }
        const resData = await response.json();
        return {
            id: resData.id,
            userPrincipalName: resData.userPrincipalName,
        };
    }
    /**
     * Assigns licenses (SKUs) to a user in Microsoft Azure Active Directory.
     */
    static async assignLicenses(orgId, azureUserId, skuIds) {
        if (!skuIds || skuIds.length === 0)
            return;
        const accessToken = await this.getAccessToken(orgId);
        const assignUrl = `https://graph.microsoft.com/v1.0/users/${azureUserId}/assignLicenses`;
        const payload = {
            addLicenses: skuIds.map((skuId) => ({
                disabledPlans: [],
                skuId: skuId,
            })),
            removeLicenses: [],
        };
        const response = await fetch(assignUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = errorText;
            try {
                const jsonErr = JSON.parse(errorText);
                errorMsg = jsonErr.error?.message || errorText;
            }
            catch (_) { }
            throw new Error(`Failed to assign Azure AD licenses to user: ${errorMsg}`);
        }
    }
}
exports.MicrosoftGraphService = MicrosoftGraphService;
