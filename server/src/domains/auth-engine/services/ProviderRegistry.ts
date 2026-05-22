import { OrganizationAuthConfig, IOrganizationAuthConfig, ProviderType } from '../../../models/OrganizationAuthConfig.js';
import { BaseSSOAdapter, SSOAdapterConfig } from '../adapters/BaseSSOAdapter.js';
import { GoogleAdapter } from '../adapters/GoogleAdapter.js';
import { MicrosoftAdapter } from '../adapters/MicrosoftAdapter.js';
import { SAML2Adapter } from '../adapters/SAML2Adapter.js';
import { OAuthAdapter } from '../adapters/OAuthAdapter.js';

/**
 * ProviderRegistry
 * Manages identity provider configurations per organization and instantiates
 * the correct SSO adapter based on provider.
 */
export class ProviderRegistry {
  private static adapterCache = new Map<string, BaseSSOAdapter>();

  /**
   * Get all enabled identity providers for an organization.
   */
  static async getProviders(organizationId: string): Promise<IOrganizationAuthConfig[]> {
    return OrganizationAuthConfig.find({
      organizationId,
      isEnabled: true,
    }).sort({ priority: 1 });
  }

  /**
   * Get the primary identity provider for an organization.
   */
  static async getPrimaryProvider(organizationId: string): Promise<IOrganizationAuthConfig | null> {
    return OrganizationAuthConfig.findOne({
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
    provider: ProviderType
  ): Promise<IOrganizationAuthConfig | null> {
    return OrganizationAuthConfig.findOne({
      organizationId,
      provider,
      isEnabled: true,
    });
  }

  /**
   * Instantiate the correct SSO adapter for a given provider configuration.
   */
  static createAdapter(provider: IOrganizationAuthConfig): BaseSSOAdapter {
    const cacheKey = `${provider.organizationId}-${provider.provider}`;

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
      samlEntryPoint: provider.samlEntryPoint,
      samlIssuer: provider.samlIssuer,
      samlCert: provider.samlCert,
      samlCallbackUrl: provider.samlCallbackUrl,
      attributeMapping: provider.attributeMapping,
    };

    let adapter: BaseSSOAdapter;

    switch (provider.provider) {
      case 'GOOGLE':
        adapter = new GoogleAdapter(config);
        break;
      case 'MICROSOFT':
        adapter = new MicrosoftAdapter(config);
        break;
      case 'SAML':
        adapter = new SAML2Adapter(config);
        break;
      case 'OAUTH':
        adapter = new OAuthAdapter(config);
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
  static clearCache(organizationId: string, provider?: ProviderType): void {
    if (provider) {
      this.adapterCache.delete(`${organizationId}-${provider}`);
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
    providerData: Partial<IOrganizationAuthConfig>
  ): Promise<IOrganizationAuthConfig> {
    const providerKey = providerData.provider;
    if (!providerKey) {
      throw new Error('Provider type is required for registration');
    }

    const existing = await OrganizationAuthConfig.findOne({
      organizationId,
      provider: providerKey,
    });

    if (existing) {
      Object.assign(existing, providerData);
      await existing.save();
      this.clearCache(organizationId, providerKey);
      return existing;
    }

    const provider = await OrganizationAuthConfig.create({
      organizationId,
      ...providerData,
    });

    return provider;
  }

  /**
   * Remove an identity provider.
   */
  static async removeProvider(organizationId: string, provider: ProviderType): Promise<boolean> {
    const result = await OrganizationAuthConfig.deleteOne({ organizationId, provider });
    this.clearCache(organizationId, provider);
    return result.deletedCount > 0;
  }

  /**
   * Dynamic org-based auth routing: determines which provider to use for a given org.
   */
  static async resolveAuthRoute(organizationId: string): Promise<{
    provider: IOrganizationAuthConfig;
    adapter: BaseSSOAdapter;
  } | null> {
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
