"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Auth0Adapter = void 0;
const BaseSSOAdapter_js_1 = require("./BaseSSOAdapter.js");
/**
 * Auth0 OAuth 2.0 Adapter
 */
class Auth0Adapter extends BaseSSOAdapter_js_1.BaseSSOAdapter {
    providerName = 'AUTH0';
    constructor(config) {
        const domain = config.domain; // e.g., 'myapp.auth0.com'
        super({
            ...config,
            authorizationUrl: config.authorizationUrl || `https://${domain}/authorize`,
            tokenUrl: config.tokenUrl || `https://${domain}/oauth/token`,
            userInfoUrl: config.userInfoUrl || `https://${domain}/userinfo`,
            scopes: config.scopes || ['openid', 'profile', 'email'],
        });
    }
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: (this.config.scopes || []).join(' '),
            state,
            audience: `https://${this.config.domain}/api/v2/`,
        });
        return `${this.config.authorizationUrl}?${params.toString()}`;
    }
    async handleCallback(code) {
        const tokenResponse = await fetch(this.config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                redirect_uri: this.config.redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new Error(`Auth0 token exchange failed: ${error}`);
        }
        const tokens = await tokenResponse.json();
        const profileResponse = await fetch(this.config.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!profileResponse.ok) {
            throw new Error('Failed to fetch Auth0 user profile');
        }
        const rawProfile = await profileResponse.json();
        return {
            profile: {
                email: rawProfile.email,
                name: rawProfile.name || rawProfile.nickname,
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
    async revokeToken(token) {
        await fetch(`https://${this.config.domain}/oauth/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                token,
            }),
        });
    }
}
exports.Auth0Adapter = Auth0Adapter;
