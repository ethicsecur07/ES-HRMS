"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderRegistry = void 0;
const IdentityProvider_js_1 = require("../models/IdentityProvider.js");
const GoogleAdapter_js_1 = require("../adapters/GoogleAdapter.js");
const MicrosoftAdapter_js_1 = require("../adapters/MicrosoftAdapter.js");
const AzureADAdapter_js_1 = require("../adapters/AzureADAdapter.js");
const OktaAdapter_js_1 = require("../adapters/OktaAdapter.js");
const Auth0Adapter_js_1 = require("../adapters/Auth0Adapter.js");
const OneLoginAdapter_js_1 = require("../adapters/OneLoginAdapter.js");
const SAML2Adapter_js_1 = require("../adapters/SAML2Adapter.js");
/**
 * ProviderRegistry
 * Manages identity provider configurations per organization and instantiates
 * the correct SSO adapter based on providerType.
 */
class ProviderRegistry {
    static adapterCache = new Map();
    /**
     * Get all enabled identity providers for an organization.
     */
    static async getProviders(organizationId) {
        return IdentityProvider_js_1.IdentityProvider.find({
            organizationId,
            isEnabled: true,
        }).sort({ priority: 1 });
    }
    /**
     * Get the primary identity provider for an organization.
     */
    static async getPrimaryProvider(organizationId) {
        return IdentityProvider_js_1.IdentityProvider.findOne({
            organizationId,
            isEnabled: true,
            isPrimary: true,
        });
    }
    /**
     * Get a specific provider config by type for an organization.
     */
    static async getProviderByType(organizationId, providerType) {
        return IdentityProvider_js_1.IdentityProvider.findOne({
            organizationId,
            providerType,
            isEnabled: true,
        });
    }
    /**
     * Instantiate the correct SSO adapter for a given provider configuration.
     */
    static createAdapter(provider) {
        const cacheKey = `${provider.organizationId}-${provider.providerType}`;
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
            apiKey: provider.apiKey,
            samlEntryPoint: provider.samlEntryPoint,
            samlIssuer: provider.samlIssuer,
            samlCert: provider.samlCert,
            samlCallbackUrl: provider.samlCallbackUrl,
            attributeMapping: provider.attributeMapping,
        };
        let adapter;
        switch (provider.providerType) {
            case 'GOOGLE':
                adapter = new GoogleAdapter_js_1.GoogleAdapter(config);
                break;
            case 'MICROSOFT':
                adapter = new MicrosoftAdapter_js_1.MicrosoftAdapter(config);
                break;
            case 'AZURE_AD':
                adapter = new AzureADAdapter_js_1.AzureADAdapter(config);
                break;
            case 'OKTA':
                adapter = new OktaAdapter_js_1.OktaAdapter(config);
                break;
            case 'AUTH0':
                adapter = new Auth0Adapter_js_1.Auth0Adapter(config);
                break;
            case 'ONELOGIN':
                adapter = new OneLoginAdapter_js_1.OneLoginAdapter(config);
                break;
            case 'SAML2':
                adapter = new SAML2Adapter_js_1.SAML2Adapter(config);
                break;
            default:
                throw new Error(`Unsupported provider type: ${provider.providerType}`);
        }
        this.adapterCache.set(cacheKey, adapter);
        return adapter;
    }
    /**
     * Clear cached adapter (e.g., when config is updated).
     */
    static clearCache(organizationId, providerType) {
        if (providerType) {
            this.adapterCache.delete(`${organizationId}-${providerType}`);
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
        const existing = await IdentityProvider_js_1.IdentityProvider.findOne({
            organizationId,
            providerType: providerData.providerType,
        });
        if (existing) {
            Object.assign(existing, providerData);
            await existing.save();
            this.clearCache(organizationId, providerData.providerType);
            return existing;
        }
        const provider = await IdentityProvider_js_1.IdentityProvider.create({
            organizationId,
            ...providerData,
        });
        return provider;
    }
    /**
     * Remove an identity provider.
     */
    static async removeProvider(organizationId, providerType) {
        const result = await IdentityProvider_js_1.IdentityProvider.deleteOne({ organizationId, providerType });
        this.clearCache(organizationId, providerType);
        return result.deletedCount > 0;
    }
    /**
     * Dynamic org-based auth routing: determines which provider to use for a given org.
     */
    static async resolveAuthRoute(organizationId) {
        const primary = await this.getPrimaryProvider(organizationId);
        if (primary && primary.providerType !== 'LOCAL') {
            return {
                provider: primary,
                adapter: this.createAdapter(primary),
            };
        }
        // Fallback to first non-LOCAL enabled provider
        const providers = await this.getProviders(organizationId);
        const ssoProvider = providers.find((p) => p.providerType !== 'LOCAL');
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
