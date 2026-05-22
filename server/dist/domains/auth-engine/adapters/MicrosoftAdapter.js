"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicrosoftAdapter = void 0;
const BaseSSOAdapter_js_1 = require("./BaseSSOAdapter.js");
/**
 * Microsoft OAuth 2.0 Adapter (Personal + Work accounts via common endpoint)
 */
class MicrosoftAdapter extends BaseSSOAdapter_js_1.BaseSSOAdapter {
    providerName = 'MICROSOFT';
    static AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    static TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    static USERINFO_URL = 'https://graph.microsoft.com/v1.0/me';
    constructor(config) {
        super({
            ...config,
            authorizationUrl: config.authorizationUrl || MicrosoftAdapter.AUTH_URL,
            tokenUrl: config.tokenUrl || MicrosoftAdapter.TOKEN_URL,
            userInfoUrl: config.userInfoUrl || MicrosoftAdapter.USERINFO_URL,
            scopes: config.scopes || ['openid', 'profile', 'email', 'User.Read'],
        });
    }
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: (this.config.scopes || []).join(' '),
            state,
            response_mode: 'query',
        });
        return `${this.config.authorizationUrl}?${params.toString()}`;
    }
    async handleCallback(code) {
        const tokenResponse = await fetch(this.config.tokenUrl, {
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
            throw new Error(`Microsoft token exchange failed: ${error}`);
        }
        const tokens = await tokenResponse.json();
        const profileResponse = await fetch(this.config.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!profileResponse.ok) {
            throw new Error('Failed to fetch Microsoft user profile');
        }
        const rawProfile = await profileResponse.json();
        return {
            profile: {
                email: rawProfile.mail || rawProfile.userPrincipalName,
                name: rawProfile.displayName,
                firstName: rawProfile.givenName,
                lastName: rawProfile.surname,
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
exports.MicrosoftAdapter = MicrosoftAdapter;
