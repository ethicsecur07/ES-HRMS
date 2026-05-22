import { IdentityProvider, IIdentityProvider, ProviderType } from '../models/IdentityProvider.js';
import { BaseSSOAdapter, SSOAdapterConfig } from '../adapters/BaseSSOAdapter.js';
import { GoogleAdapter } from '../adapters/GoogleAdapter.js';
import { MicrosoftAdapter } from '../adapters/MicrosoftAdapter.js';
import { AzureADAdapter } from '../adapters/AzureADAdapter.js';
import { OktaAdapter } from '../adapters/OktaAdapter.js';
import { Auth0Adapter } from '../adapters/Auth0Adapter.js';
import { OneLoginAdapter } from '../adapters/OneLoginAdapter.js';
import { SAML2Adapter } from '../adapters/SAML2Adapter.js';

/**
 * ProviderRegistry
 * Manages identity provider configurations per organization and instantiates
 * the correct SSO adapter based on providerType.
 */
export class ProviderRegistry {
  private static adapterCache = new Map<string, BaseSSOAdapter>();

  /**
   * Get all enabled identity providers for an organization.
   */
  static async getProviders(organizationId: string): Promise<IIdentityProvider[]> {
    return IdentityProvider.find({
      organizationId,
      isEnabled: true,
    }).sort({ priority: 1 });
  }

  /**
   * Get the primary identity provider for an organization.
   */
  static async getPrimaryProvider(organizationId: string): Promise<IIdentityProvider | null> {
    return IdentityProvider.findOne({
      organizationId,
      isEnabled: true,
      isPrimary: true,
    });
  }

  /**
   * Get a specific provider config by type for an organization.
   */
  static async getProviderByType(
    organizationId: string,
    providerType: ProviderType
  ): Promise<IIdentityProvider | null> {
    return IdentityProvider.findOne({
      organizationId,
      providerType,
      isEnabled: true,
    });
  }

  /**
   * Instantiate the correct SSO adapter for a given provider configuration.
   */
  static createAdapter(provider: IIdentityProvider): BaseSSOAdapter {
    const cacheKey = `${provider.organizationId}-${provider.providerType}`;

    // Return cached adapter if config hasn't changed
    if (this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey)!;
    }

    const config: SSOAdapterConfig = {
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

    let adapter: BaseSSOAdapter;

    switch (provider.providerType) {
      case 'GOOGLE':
        adapter = new GoogleAdapter(config);
        break;
      case 'MICROSOFT':
        adapter = new MicrosoftAdapter(config);
        break;
      case 'AZURE_AD':
        adapter = new AzureADAdapter(config);
        break;
      case 'OKTA':
        adapter = new OktaAdapter(config);
        break;
      case 'AUTH0':
        adapter = new Auth0Adapter(config);
        break;
      case 'ONELOGIN':
        adapter = new OneLoginAdapter(config);
        break;
      case 'SAML2':
        adapter = new SAML2Adapter(config);
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
  static clearCache(organizationId: string, providerType?: ProviderType): void {
    if (providerType) {
      this.adapterCache.delete(`${organizationId}-${providerType}`);
    } else {
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
  static async registerProvider(
    organizationId: string,
    providerData: Partial<IIdentityProvider>
  ): Promise<IIdentityProvider> {
    const existing = await IdentityProvider.findOne({
      organizationId,
      providerType: providerData.providerType,
    });

    if (existing) {
      Object.assign(existing, providerData);
      await existing.save();
      this.clearCache(organizationId, providerData.providerType as ProviderType);
      return existing;
    }

    const provider = await IdentityProvider.create({
      organizationId,
      ...providerData,
    });

    return provider;
  }

  /**
   * Remove an identity provider.
   */
  static async removeProvider(organizationId: string, providerType: ProviderType): Promise<boolean> {
    const result = await IdentityProvider.deleteOne({ organizationId, providerType });
    this.clearCache(organizationId, providerType);
    return result.deletedCount > 0;
  }

  /**
   * Dynamic org-based auth routing: determines which provider to use for a given org.
   */
  static async resolveAuthRoute(organizationId: string): Promise<{
    provider: IIdentityProvider;
    adapter: BaseSSOAdapter;
  } | null> {
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
