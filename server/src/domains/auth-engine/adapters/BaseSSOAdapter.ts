/**
 * Base SSO Adapter Interface
 * All identity provider adapters must implement this contract.
 */

export interface SSOUserProfile {
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  groups?: string[];
  roles?: string[];
  department?: string;
  raw: Record<string, any>; // raw profile from provider
}

export interface SSOTokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface SSOAuthResult {
  profile: SSOUserProfile;
  tokens: SSOTokenSet;
  provider: string;
}

export interface SSOAdapterConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];
  tenantId?: string;
  domain?: string;
  apiKey?: string;
  samlEntryPoint?: string;
  samlIssuer?: string;
  samlCert?: string;
  samlCallbackUrl?: string;
  attributeMapping?: {
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
    department?: string;
  };
}

export abstract class BaseSSOAdapter {
  protected config: SSOAdapterConfig;
  public abstract readonly providerName: string;

  constructor(config: SSOAdapterConfig) {
    this.config = config;
  }

  /**
   * Generate the authorization URL to redirect the user to the IDP.
   * @param state - CSRF token / state parameter
   */
  abstract getAuthorizationUrl(state: string): string;

  /**
   * Exchange the authorization code for tokens and retrieve user profile.
   * @param code - Authorization code from callback
   */
  abstract handleCallback(code: string): Promise<SSOAuthResult>;

  /**
   * Validate an existing token (optional, not all providers support introspection).
   */
  async validateToken(token: string): Promise<boolean> {
    // Default: no-op, subclasses can override
    return true;
  }

  /**
   * Revoke a token (optional).
   */
  async revokeToken(token: string): Promise<void> {
    // Default: no-op
  }

  /**
   * Map raw profile to standard SSOUserProfile using attributeMapping.
   */
  protected mapProfile(rawProfile: Record<string, any>): SSOUserProfile {
    const mapping = this.config.attributeMapping || { email: 'email', name: 'name' };
    return {
      email: this.getNestedValue(rawProfile, mapping.email) || '',
      name: this.getNestedValue(rawProfile, mapping.name) || '',
      firstName: mapping.firstName ? this.getNestedValue(rawProfile, mapping.firstName) : undefined,
      lastName: mapping.lastName ? this.getNestedValue(rawProfile, mapping.lastName) : undefined,
      groups: mapping.groups ? this.getNestedValue(rawProfile, mapping.groups) : undefined,
      department: mapping.department ? this.getNestedValue(rawProfile, mapping.department) : undefined,
      raw: rawProfile,
    };
  }

  /**
   * Helper to extract nested values from a dot-separated path.
   */
  protected getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }
}
