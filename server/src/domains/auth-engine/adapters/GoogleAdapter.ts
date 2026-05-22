import { BaseSSOAdapter, SSOAuthResult, SSOAdapterConfig } from './BaseSSOAdapter.js';

/**
 * Google OAuth 2.0 Adapter
 * Uses Google's OpenID Connect flow for authentication.
 */
export class GoogleAdapter extends BaseSSOAdapter {
  public readonly providerName = 'GOOGLE';

  private static readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private static readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private static readonly USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

  constructor(config: SSOAdapterConfig) {
    super({
      ...config,
      authorizationUrl: config.authorizationUrl || GoogleAdapter.AUTH_URL,
      tokenUrl: config.tokenUrl || GoogleAdapter.TOKEN_URL,
      userInfoUrl: config.userInfoUrl || GoogleAdapter.USERINFO_URL,
      scopes: config.scopes || ['openid', 'profile', 'email'],
    });
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scopes || []).join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<SSOAuthResult> {
    // Exchange code for tokens
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
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile
    const profileResponse = await fetch(this.config.userInfoUrl!, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch Google user profile');
    }

    const rawProfile = await profileResponse.json();

    return {
      profile: {
        email: rawProfile.email,
        name: rawProfile.name || `${rawProfile.given_name || ''} ${rawProfile.family_name || ''}`.trim(),
        firstName: rawProfile.given_name,
        lastName: rawProfile.family_name,
        avatar: rawProfile.picture,
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
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }
}
