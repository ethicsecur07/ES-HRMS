"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthAdapter = void 0;
const BaseSSOAdapter_js_1 = require("./BaseSSOAdapter.js");
/**
 * Generic OAuth 2.0 Provider Engine Adapter
 * Dynamically communicates with arbitrary OAuth providers configured by admins.
 */
class OAuthAdapter extends BaseSSOAdapter_js_1.BaseSSOAdapter {
    providerName = 'OAUTH';
    constructor(config) {
        super(config);
    }
    getAuthorizationUrl(state) {
        if (!this.config.authorizationUrl) {
            throw new Error('OAuth Provider Engine: Authorization URL is not configured.');
        }
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: (this.config.scopes || ['openid', 'profile', 'email']).join(' '),
            state,
        });
        return `${this.config.authorizationUrl}?${params.toString()}`;
    }
    async handleCallback(code) {
        if (!this.config.tokenUrl) {
            throw new Error('OAuth Provider Engine: Token URL is not configured.');
        }
        if (!this.config.userInfoUrl) {
            throw new Error('OAuth Provider Engine: User Info URL is not configured.');
        }
        // Exchange authorization code for tokens
        const tokenResponse = await fetch(this.config.tokenUrl, {
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
            throw new Error(`OAuth Provider Engine token exchange failed: ${error}`);
        }
        const tokens = await tokenResponse.json();
        // Fetch user profile
        const profileResponse = await fetch(this.config.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!profileResponse.ok) {
            const error = await profileResponse.text();
            throw new Error(`OAuth Provider Engine profile fetch failed: ${error}`);
        }
        const rawProfile = await profileResponse.json();
        // Map profile dynamically using configuration mapping
        const mapped = this.mapProfile(rawProfile);
        return {
            profile: mapped,
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
exports.OAuthAdapter = OAuthAdapter;
