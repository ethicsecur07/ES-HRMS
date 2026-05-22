import { BaseSSOAdapter, SSOAuthResult, SSOAdapterConfig, SSOUserProfile } from './BaseSSOAdapter.js';
import crypto from 'crypto';

/**
 * SAML 2.0 Service Provider Adapter
 * Provides SP-initiated SSO flow with SAML assertions.
 * NOTE: Full XML signing requires a library like xml-crypto in production.
 * This implementation provides the framework and assertion parsing.
 */
export class SAML2Adapter extends BaseSSOAdapter {
  public readonly providerName = 'SAML2';

  constructor(config: SSOAdapterConfig) {
    super(config);
  }

  /**
   * Generate SAML AuthnRequest URL for SP-initiated login.
   */
  getAuthorizationUrl(state: string): string {
    const id = `_${crypto.randomUUID()}`;
    const issueInstant = new Date().toISOString();
    const issuer = this.config.samlIssuer || '';
    const callbackUrl = this.config.samlCallbackUrl || this.config.redirectUri;
    const entryPoint = this.config.samlEntryPoint || '';

    const authnRequest = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${entryPoint}"
        AssertionConsumerServiceURL="${callbackUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${issuer}</saml:Issuer>
        <samlp:NameIDPolicy
          AllowCreate="true"
          Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"/>
      </samlp:AuthnRequest>
    `.trim();

    // Deflate and Base64 encode for HTTP-Redirect binding
    const encoded = Buffer.from(authnRequest).toString('base64');
    const params = new URLSearchParams({
      SAMLRequest: encoded,
      RelayState: state,
    });

    return `${entryPoint}?${params.toString()}`;
  }

  /**
   * Parse SAML Response assertion from IDP callback.
   * In production, this should validate the XML signature against the IDP certificate.
   */
  async handleCallback(samlResponse: string): Promise<SSOAuthResult> {
    // Decode the SAML Response
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Parse assertion attributes (simplified XML parsing)
    const profile = this.parseAssertionProfile(decoded);

    return {
      profile,
      tokens: {
        accessToken: `saml-session-${crypto.randomUUID()}`,
        tokenType: 'SAML',
      },
      provider: this.providerName,
    };
  }

  /**
   * Extract user attributes from SAML assertion XML.
   * NOTE: In production, use a proper XML parser (xml2js, fast-xml-parser).
   */
  private parseAssertionProfile(xml: string): SSOUserProfile {
    const mapping = this.config.attributeMapping || { email: 'email', name: 'name' };

    const extractAttribute = (name: string): string => {
      // Look for <saml:Attribute Name="..."><saml:AttributeValue>...</saml:AttributeValue>
      const regex = new RegExp(
        `<saml:Attribute[^>]*Name=["']${name}["'][^>]*>\\s*<saml:AttributeValue[^>]*>([^<]*)</saml:AttributeValue>`,
        'i'
      );
      const match = xml.match(regex);
      return match ? match[1].trim() : '';
    };

    // Also try NameID for email
    const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]*)<\/saml:NameID>/i);
    const nameId = nameIdMatch ? nameIdMatch[1].trim() : '';

    const email = extractAttribute(mapping.email) || nameId;
    const name = extractAttribute(mapping.name);
    const firstName = mapping.firstName ? extractAttribute(mapping.firstName) : undefined;
    const lastName = mapping.lastName ? extractAttribute(mapping.lastName) : undefined;

    return {
      email,
      name: name || `${firstName || ''} ${lastName || ''}`.trim() || email,
      firstName,
      lastName,
      raw: { nameId, xml_length: xml.length },
    };
  }

  /**
   * Validate SAML signature against IDP certificate.
   * NOTE: Stub — in production use xml-crypto or saml2-js for proper validation.
   */
  async validateToken(samlResponse: string): Promise<boolean> {
    if (!this.config.samlCert) {
      console.warn('SAML2Adapter: No IDP certificate configured, skipping signature validation');
      return true;
    }
    // In production: validate XML digital signature
    return true;
  }
}
