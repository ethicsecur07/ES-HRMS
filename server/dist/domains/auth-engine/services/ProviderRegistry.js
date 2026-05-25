"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderRegistry = void 0;
const OrganizationAuthConfig_js_1 = require("../../../models/OrganizationAuthConfig.js");
const GoogleAdapter_js_1 = require("../adapters/GoogleAdapter.js");
const MicrosoftAdapter_js_1 = require("../adapters/MicrosoftAdapter.js");
const SAML2Adapter_js_1 = require("../adapters/SAML2Adapter.js");
const OAuthAdapter_js_1 = require("../adapters/OAuthAdapter.js");
/**
 * ProviderRegistry
 * Manages identity provider configurations per organization and instantiates
 * the correct SSO adapter based on provider.
 */
class ProviderRegistry {
    static adapterCache = new Map();
    /**
     * Get all enabled identity providers for an organization.
     */
    static async getProviders(organizationId) {
        return OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({
            organizationId,
            isEnabled: true,
        }).sort({ priority: 1 });
    }
    /**
     * Get the primary identity provider for an organization.
     */
    static async getPrimaryProvider(organizationId) {
        return OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId,
            isEnabled: true,
            isPrimary: true,
        });
    }
    /**
     * Get a specific provider config by type for an organization.
     */
    static async getProviderByType(organizationId, provider) {
        return OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId,
            provider,
            isEnabled: true,
        });
    }
    /**
     * Instantiate the correct SSO adapter for a given provider configuration.
     */
    static createAdapter(provider) {
        const cacheKey = `${provider.organizationId}-${provider.provider}`;
        // Return cached adapter if config hasn't changed
        if (this.adapterCache.has(cacheKey)) {
            return this.adapterCache.get(cacheKey);
        }
        const config = {
            clientId: provider.clientId || '',
            clientSecret: provider.clientSecret || '',
            redirectUri: provider.redirectUri || '',
            authorizationUrl: provider.authorizationUrl,
            tokenUrl: provider.tokenUrl,
            userInfoUrl: provider.userInfoUrl,
            scopes: provider.scopes,
            tenantId: provider.tenantId,
            domain: provider.domain,
            samlEntryPoint: provider.samlEntryPoint,
            samlIssuer: provider.samlIssuer,
            samlCert: provider.samlCert,
            samlCallbackUrl: provider.samlCallbackUrl,
            attributeMapping: provider.attributeMapping,
        };
        let adapter;
        switch (provider.provider) {
            case 'GOOGLE':
                adapter = new GoogleAdapter_js_1.GoogleAdapter(config);
                break;
            case 'MICROSOFT':
                adapter = new MicrosoftAdapter_js_1.MicrosoftAdapter(config);
                break;
            case 'SAML':
                adapter = new SAML2Adapter_js_1.SAML2Adapter(config);
                break;
            case 'OAUTH':
                adapter = new OAuthAdapter_js_1.OAuthAdapter(config);
                break;
            default:
                throw new Error(`Unsupported provider type: ${provider.provider}`);
        }
        this.adapterCache.set(cacheKey, adapter);
        return adapter;
    }
    /**
     * Clear cached adapter (e.g., when config is updated).
     */
    static clearCache(organizationId, provider) {
        if (provider) {
            this.adapterCache.delete(`${organizationId}-${provider}`);
        }
        else {
            // Clear all adapters for this org
            for (const key of this.adapterCache.keys()) {
                if (key.startsWith(`${organizationId}-`)) {
                    this.adapterCache.delete(key);
                }
            }
        }
    }
    /**
     * Register or update an identity provider for an organization.
     */
    static async registerProvider(organizationId, providerData) {
        const providerKey = providerData.provider;
        if (!providerKey) {
            throw new Error('Provider type is required for registration');
        }
        const existing = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.findOne({
            organizationId,
            provider: providerKey,
        });
        if (existing) {
            Object.assign(existing, providerData);
            await existing.save();
            this.clearCache(organizationId, providerKey);
            return existing;
        }
        const provider = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.create({
            organizationId,
            ...providerData,
        });
        return provider;
    }
    /**
     * Remove an identity provider.
     */
    static async removeProvider(organizationId, provider) {
        const result = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.deleteOne({ organizationId, provider });
        this.clearCache(organizationId, provider);
        return result.deletedCount > 0;
    }
    /**
     * Dynamic org-based auth routing: determines which provider to use for a given org.
     */
    static async resolveAuthRoute(organizationId) {
        const primary = await this.getPrimaryProvider(organizationId);
        if (primary && primary.provider !== 'LOCAL') {
            return {
                provider: primary,
                adapter: this.createAdapter(primary),
            };
        }
        // Fallback to first non-LOCAL enabled provider
        const providers = await this.getProviders(organizationId);
        const ssoProvider = providers.find((p) => p.provider !== 'LOCAL');
        if (ssoProvider) {
            return {
                provider: ssoProvider,
                adapter: this.createAdapter(ssoProvider),
            };
        }
        return null; // org uses LOCAL auth only
    }
}
exports.ProviderRegistry = ProviderRegistry;
