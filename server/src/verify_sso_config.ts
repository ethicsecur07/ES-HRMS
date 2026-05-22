import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { connectDB } from './config/db.js';
import { Organization } from './models/Organization.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';
import { ProviderRegistry } from './domains/auth-engine/services/ProviderRegistry.js';
import { encrypt, decrypt } from './utils/crypto.js';

dotenv.config();

// Helper to mock Express request
const createMockReq = (body: any, params: any = {}, user: any = {}): any => ({
  body,
  params,
  user,
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  },
  socket: {
    remoteAddress: '127.0.0.1',
  },
});

// Helper to mock Express response
const createMockRes = (): any => {
  const res: any = {};
  res.statusCode = 200;
  res.jsonData = null;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

async function runSSOTests() {
  console.log('--- Connecting to DB ---');
  await connectDB();

  const orgId = new mongoose.Types.ObjectId();
  const testSlug = 'sso-testorg-' + Math.random().toString(36).substring(2, 7);
  const adminEmail = 'admin-' + Math.random().toString(36).substring(2, 7) + '@test.com';

  console.log('--- Cleaning Up SSO Test Data ---');
  await Organization.deleteMany({ slug: testSlug });
  await OrganizationAuthConfig.deleteMany({ organizationId: orgId });

  console.log('--- Creating Test Organization ---');
  const org = await Organization.create({
    _id: orgId,
    name: 'SSO Testing Corp',
    slug: testSlug,
    isActive: true,
    sector: 'IT',
    adminEmail,
    settings: { theme: 'dark' },
  } as any);
  console.log(`✔ Organization created with ID: ${orgId} and Slug: ${testSlug}`);

  console.log('--- Test 1: Registering & Encrypting Google Workspace Config ---');
  const googlePayload = {
    provider: 'GOOGLE',
    displayName: 'Corporate Google Workspace',
    isEnabled: true,
    isPrimary: true,
    clientId: 'google-client-id-xyz',
    clientSecret: 'super-secret-google-token-12345',
    redirectUri: 'http://localhost:5173/sso/callback',
    autoProvision: true,
    defaultRoleCode: 'EMPLOYEE',
  };

  const registeredGoogle = await ProviderRegistry.registerProvider(orgId.toString(), googlePayload as any);
  console.log('✔ ProviderRegistry.registerProvider completed.');

  // Fetch directly from MongoDB (without invoking the model post-init middleware by using lean() or raw collection query)
  const rawConfig = await mongoose.connection.collection('organization_auth_configs').findOne({
    organizationId: orgId,
    provider: 'GOOGLE',
  });

  if (!rawConfig) {
    throw new Error('Google config not found in database!');
  }

  console.log('Raw Client Secret in DB:', rawConfig.clientSecret);
  if (rawConfig.clientSecret === 'super-secret-google-token-12345') {
    throw new Error('Client Secret was saved in plaintext! Encryption failed.');
  }
  console.log('✔ Verified Google clientSecret is encrypted at rest in MongoDB.');

  // Fetch using the model (which automatically decrypts on init)
  const decryptedConfig = await OrganizationAuthConfig.findOne({
    organizationId: orgId,
    provider: 'GOOGLE',
  });

  if (!decryptedConfig) {
    throw new Error('Google config model query returned null!');
  }

  if (decryptedConfig.clientSecret !== 'super-secret-google-token-12345') {
    throw new Error(`Client Secret decryption failed. Got: ${decryptedConfig.clientSecret}`);
  }
  console.log('✔ Verified post-init decrypts clientSecret correctly.');

  console.log('--- Test 2: Instantiate Google Adapter and verify initiate redirection ---');
  const adapter = ProviderRegistry.createAdapter(decryptedConfig);
  const state = 'custom-state-uuid';
  const authUrl = adapter.getAuthorizationUrl(state);
  console.log('Generated Google Auth URL:', authUrl);

  if (!authUrl.includes('client_id=google-client-id-xyz') || !authUrl.includes('state=custom-state-uuid')) {
    throw new Error(`Google Auth URL is malformed: ${authUrl}`);
  }
  console.log('✔ Verified Google adapter creates correct authorization URL.');

  console.log('--- Test 3: Registering Custom OAuth Provider and Claim Mapping ---');
  const oauthPayload = {
    provider: 'OAUTH',
    displayName: 'Okta Enterprise SSO',
    isEnabled: true,
    isPrimary: false,
    clientId: 'okta-client-111',
    clientSecret: 'okta-secret-222',
    redirectUri: 'http://localhost:5173/sso/callback',
    authorizationUrl: 'https://okta.example.com/oauth2/v1/authorize',
    tokenUrl: 'https://okta.example.com/oauth2/v1/token',
    userInfoUrl: 'https://okta.example.com/oauth2/v1/userinfo',
    scopes: ['openid', 'profile', 'email', 'groups'],
    attributeMapping: {
      email: 'upn',
      name: 'display_name',
      firstName: 'given_name',
      lastName: 'family_name',
    },
    autoProvision: false,
  };

  const registeredOauth = await ProviderRegistry.registerProvider(orgId.toString(), oauthPayload as any);
  const oauthConfig = await OrganizationAuthConfig.findOne({
    organizationId: orgId,
    provider: 'OAUTH',
  });

  if (!oauthConfig) {
    throw new Error('Custom OAuth config not found!');
  }

  const oauthAdapter = ProviderRegistry.createAdapter(oauthConfig);
  const oauthAuthUrl = oauthAdapter.getAuthorizationUrl(state);
  console.log('Generated Custom OAuth Auth URL:', oauthAuthUrl);

  if (!oauthAuthUrl.startsWith('https://okta.example.com/oauth2/v1/authorize') || !oauthAuthUrl.includes('scope=openid+profile+email+groups')) {
    throw new Error(`Custom OAuth Auth URL is malformed: ${oauthAuthUrl}`);
  }
  console.log('✔ Verified Custom OAuth adapter authorization URL.');

  // Test mapProfile method mapping claims
  const rawUserProfileMock = {
    upn: 'john.doe@oktashared.com',
    display_name: 'John Doe Okta',
    given_name: 'John',
    family_name: 'Doe',
  };

  const mappedProfile = (oauthAdapter as any).mapProfile(rawUserProfileMock);
  console.log('Mapped profile claims:', mappedProfile);

  if (mappedProfile.email !== 'john.doe@oktashared.com' || mappedProfile.name !== 'John Doe Okta') {
    throw new Error('Attribute mapping did not map upn/display_name properly!');
  }
  console.log('✔ Verified Custom OAuth profile claim mapping.');

  console.log('--- Test 4: Removing Identity Provider Config ---');
  const removed = await ProviderRegistry.removeProvider(orgId.toString(), 'GOOGLE');
  if (!removed) {
    throw new Error('Failed to delete Google provider config!');
  }

  const searchRemoved = await OrganizationAuthConfig.findOne({
    organizationId: orgId,
    provider: 'GOOGLE',
  });

  if (searchRemoved) {
    throw new Error('Google config still exists after removal!');
  }
  console.log('✔ Verified provider removal deletes configuration from DB.');

  console.log('--- Cleaning Up SSO Test Data ---');
  await Organization.deleteMany({ slug: testSlug });
  await OrganizationAuthConfig.deleteMany({ organizationId: orgId });

  console.log('🎉 ALL DYNAMIC SSO & CUSTOM OAUTH ENGINE TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
}

runSSOTests().catch((err) => {
  console.error('❌ SSO Verification failed with error:', err);
  process.exit(1);
});
