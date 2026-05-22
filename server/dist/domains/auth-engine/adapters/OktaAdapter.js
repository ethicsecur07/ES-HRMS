"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OktaAdapter = void 0;
const BaseSSOAdapter_js_1 = require("./BaseSSOAdapter.js");
/**
 * Okta OAuth 2.0 / OpenID Connect Adapter
 */
class OktaAdapter extends BaseSSOAdapter_js_1.BaseSSOAdapter {
    providerName = 'OKTA';
    constructor(config) {
        const domain = config.domain; // e.g., 'dev-12345.okta.com'
        super({
            ...config,
            authorizationUrl: config.authorizationUrl || `https://${domain}/oauth2/default/v1/authorize`,
            tokenUrl: config.tokenUrl || `https://${domain}/oauth2/default/v1/token`,
            userInfoUrl: config.userInfoUrl || `https://${domain}/oauth2/default/v1/userinfo`,
            scopes: config.scopes || ['openid', 'profile', 'email', 'groups'],
        });
    }
    getAuthorizationUrl(state) {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            response_type: 'code',
            scope: (this.config.scopes || []).join(' '),
            state,
        });
        return `${this.config.authorizationUrl}?${params.toString()}`;
    }
    async handleCallback(code) {
        const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        const tokenResponse = await fetch(this.config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                code,
                redirect_uri: this.config.redirectUri,
                grant_type: 'authorization_code',
            }),
        });
        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new Error(`Okta token exchange failed: ${error}`);
        }
        const tokens = await tokenResponse.json();
        const profileResponse = await fetch(this.config.userInfoUrl, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!profileResponse.ok) {
            throw new Error('Failed to fetch Okta user profile');
        }
        const rawProfile = await profileResponse.json();
        return {
            profile: {
                email: rawProfile.email,
                name: rawProfile.name || `${rawProfile.given_name || ''} ${rawProfile.family_name || ''}`.trim(),
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
    async revokeToken(token) {
        const basicAuth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
        const domain = this.config.domain;
        await fetch(`https://${domain}/oauth2/default/v1/revoke`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({ token, token_type_hint: 'access_token' }),
        });
    }
}
exports.OktaAdapter = OktaAdapter;
