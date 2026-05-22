import { BaseSSOAdapter, SSOAuthResult, SSOAdapterConfig } from './BaseSSOAdapter.js';

/**
 * OneLogin OpenID Connect Adapter
 */
export class OneLoginAdapter extends BaseSSOAdapter {
  public readonly providerName = 'ONELOGIN';

  constructor(config: SSOAdapterConfig) {
    const domain = config.domain; // e.g., 'mycompany.onelogin.com'
    super({
      ...config,
      authorizationUrl: config.authorizationUrl || `https://${domain}/oidc/2/auth`,
      tokenUrl: config.tokenUrl || `https://${domain}/oidc/2/token`,
      userInfoUrl: config.userInfoUrl || `https://${domain}/oidc/2/me`,
      scopes: config.scopes || ['openid', 'profile', 'email', 'groups'],
    });
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scopes || []).join(' '),
      state,
    });
    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<SSOAuthResult> {
    const tokenResponse = await fetch(this.config.tokenUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`OneLogin token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    const profileResponse = await fetch(this.config.userInfoUrl!, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch OneLogin user profile');
    }

    const rawProfile = await profileResponse.json();

    return {
      profile: {
        email: rawProfile.email,
        name: rawProfile.name || rawProfile.preferred_username,
        firstName: rawProfile.given_name,
        lastName: rawProfile.family_name,
        groups: rawProfile.groups,
        raw: rawProfile,
      },
      tokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
      },
      provider: this.providerName,
    };
  }

  async revokeToken(token: string): Promise<void> {
    await fetch(`https://${this.config.domain}/oidc/2/token/revocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        token_type_hint: 'access_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
  }
}
