import { BaseSSOAdapter, SSOAuthResult, SSOAdapterConfig } from './BaseSSOAdapter.js';

/**
 * Azure Active Directory Adapter
 * Uses tenant-specific endpoints for enterprise orgs.
 */
export class AzureADAdapter extends BaseSSOAdapter {
  public readonly providerName = 'AZURE_AD';

  constructor(config: SSOAdapterConfig) {
    const tenantId = config.tenantId || 'common';
    super({
      ...config,
      authorizationUrl: config.authorizationUrl || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenUrl: config.tokenUrl || `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      userInfoUrl: config.userInfoUrl || 'https://graph.microsoft.com/v1.0/me',
      scopes: (config.scopes && config.scopes.length > 0) ? config.scopes : ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All'],
    });
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: (this.config.scopes || []).join(' '),
      state,
      response_mode: 'query',
      prompt: 'select_account',
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
        scope: (this.config.scopes || []).join(' '),
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Azure AD token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Fetch user profile from MS Graph
    const profileResponse = await fetch(this.config.userInfoUrl!, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to fetch Azure AD user profile');
    }

    const rawProfile = await profileResponse.json();

    // Optionally fetch group memberships
    let groups: string[] = [];
    try {
      const groupsResponse = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        groups = (groupsData.value || [])
          .filter((g: any) => g['@odata.type'] === '#microsoft.graph.group')
          .map((g: any) => g.displayName);
      }
    } catch {
      // Groups fetch is optional, don't fail auth
    }

    return {
      profile: {
        email: rawProfile.mail || rawProfile.userPrincipalName,
        name: rawProfile.displayName,
        firstName: rawProfile.givenName,
        lastName: rawProfile.surname,
        department: rawProfile.department,
        jobTitle: rawProfile.jobTitle,
        groups,
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
}
