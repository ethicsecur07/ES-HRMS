import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Organization } from './models/Organization.js';
import { OrganizationAuthConfig } from './models/OrganizationAuthConfig.js';
import { UserSession } from './models/UserSession.js';
import { LoginEvent } from './domains/auth-engine/models/LoginEvent.js';
import { PasswordService } from './domains/auth-engine/services/PasswordService.js';
import { LoginRiskService } from './domains/auth-engine/services/LoginRiskService.js';
import { login, refreshToken } from './controllers/auth.controller.js';

dotenv.config();

// Helper to mock Express request
const createMockReq = (body: any, cookies: any = {}, headers: any = {}, ip: string = '127.0.0.1'): any => ({
  body,
  cookies,
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ...headers,
  },
  ip,
});

// Helper to mock Express response
const createMockRes = (): any => {
  const res: any = {};
  res.statusCode = 200;
  res.jsonData = null;
  res.cookiesList = {} as any;
  res.clearedCookies = [] as string[];

  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  res.cookie = (name: string, val: string, options: any) => {
    res.cookiesList[name] = { val, options };
    return res;
  };
  res.clearCookie = (name: string, options: any) => {
    res.clearedCookies.push(name);
    delete res.cookiesList[name];
    return res;
  };
  return res;
};

async function runTests() {
  console.log('--- Connecting to DB ---');
  await connectDB();

  // Drop legacy index on adminEmail if it exists to prevent E11000 duplicate key error on organizations
  try {
    await mongoose.connection.collection('organizations').dropIndex('adminEmail_1');
    console.log('✔ Dropped legacy adminEmail_1 index from organizations collection.');
  } catch (err) {
    // If it doesn't exist, ignore
  }

  const orgId = new mongoose.Types.ObjectId();
  const testSlug = 'testorg-' + Math.random().toString(36).substring(2, 7);
  const testEmail = 'test-auth-user@example.com';
  const testPassword = 'Password123!';

  console.log('--- Cleaning Up Test Data ---');
  await User.deleteMany({ email: testEmail });
  await Organization.deleteMany({ slug: testSlug });
  await OrganizationAuthConfig.deleteMany({ organizationId: orgId });
  await UserSession.deleteMany({ userId: { $exists: true } }); // Clean sessions during test runs
  await LoginEvent.deleteMany({ email: testEmail });

  console.log('--- Creating Test Organization and Config ---');
  const org = await Organization.create({
    _id: orgId,
    name: 'Test Auth Organization',
    slug: testSlug,
    isActive: true,
    sector: 'IT',
    adminEmail: 'admin-' + Math.random().toString(36).substring(2, 7) + '@test.com',
    settings: { theme: 'dark' },
  } as any);

  await OrganizationAuthConfig.create({
    organizationId: orgId,
    provider: 'LOCAL',
    isEnabled: true,
  });

  console.log('--- 1. Testing Legacy Bcrypt Password Setup ---');
  const bcryptHash = await bcrypt.hash(testPassword, 12);
  const testUser = await User.create({
    name: 'Auth Test User',
    email: testEmail,
    password: bcryptHash,
    role: 'ADMIN',
    isActive: true,
    organizationId: orgId,
  });

  console.log('Bcrypt legacy user created.');
  
  // Verify that the hash does not start with $argon2
  if (testUser.password && testUser.password.startsWith('$argon2')) {
    throw new Error('Test setup error: Password should be a bcrypt hash, not argon2.');
  }
  console.log('✔ Confirmed legacy user has bcrypt hash.');

  console.log('--- 2. Testing Successful Login & Password Migration to Argon2 ---');
  const req1 = createMockReq({
    email: testEmail,
    password: testPassword,
    tenantSlug: testSlug,
  });
  const res1 = createMockRes();

  await login(req1, res1);

  if (res1.statusCode !== 200) {
    throw new Error(`Login failed with code ${res1.statusCode}: ${JSON.stringify(res1.jsonData)}`);
  }

  console.log('✔ Login successful with legacy bcrypt password.');

  // Check if password has migrated to Argon2 in database
  const updatedUser = await User.findById(testUser._id).select('+password');
  if (!updatedUser || !updatedUser.password) {
    throw new Error('User not found in DB after login.');
  }

  if (!updatedUser.password.startsWith('$argon2')) {
    throw new Error('Password was not migrated to Argon2 after successful login!');
  }
  console.log('✔ Password transparently migrated to Argon2 in database:', updatedUser.password.substring(0, 30) + '...');

  // Verify that subsequent login using the new Argon2 password still works perfectly
  const req2 = createMockReq({
    email: testEmail,
    password: testPassword,
    tenantSlug: testSlug,
  });
  const res2 = createMockRes();
  await login(req2, res2);

  if (res2.statusCode !== 200) {
    throw new Error(`Subsequent login with migrated Argon2 password failed: ${JSON.stringify(res2.jsonData)}`);
  }
  console.log('✔ Subsequent login with migrated Argon2 password succeeded.');

  console.log('--- 3. Testing Session Concurrency Limit (Max 3) ---');
  // Clean all sessions for user
  await UserSession.deleteMany({ userId: testUser._id });

  // Log in 4 times sequentially
  const sessionTokens: string[] = [];
  const refreshTokens: string[] = [];
  
  for (let i = 1; i <= 4; i++) {
    const req = createMockReq({
      email: testEmail,
      password: testPassword,
      tenantSlug: testSlug,
    });
    const res = createMockRes();
    await login(req, res);
    
    if (res.statusCode !== 200) {
      throw new Error(`Login ${i} failed`);
    }
    
    sessionTokens.push(res.jsonData.token);
    refreshTokens.push(res.cookiesList.refreshToken.val);
    
    // Slight delay to ensure ordered timestamps
    await new Promise((r) => setTimeout(r, 100));
  }

  // Count active vs revoked sessions
  const sessions = await UserSession.find({ userId: testUser._id }).sort({ createdAt: 1 });
  console.log(`Total sessions created: ${sessions.length}`);
  
  const activeSessions = sessions.filter(s => !s.isRevoked);
  const revokedSessions = sessions.filter(s => s.isRevoked);

  console.log(`Active sessions: ${activeSessions.length}, Revoked sessions: ${revokedSessions.length}`);
  
  if (activeSessions.length !== 3) {
    throw new Error(`Expected exactly 3 active sessions, got ${activeSessions.length}`);
  }
  if (revokedSessions.length !== 1) {
    throw new Error(`Expected exactly 1 revoked session (the oldest), got ${revokedSessions.length}`);
  }

  // Confirm the oldest session was indeed the one revoked
  if (!sessions[0].isRevoked) {
    throw new Error('Oldest session was not revoked.');
  }
  console.log('✔ Oldest session successfully terminated when concurrency exceeded 3.');

  console.log('--- 4. Testing Refresh Token Rotation & Replay Attack Prevention ---');
  // Take one of the active refresh tokens (from the last successful login, i.e., refreshTokens[3])
  const activeRefreshToken = refreshTokens[3];
  
  // Perform refresh token request
  const reqRefresh1 = createMockReq({}, { refreshToken: activeRefreshToken });
  const resRefresh1 = createMockRes();
  
  await refreshToken(reqRefresh1, resRefresh1);
  
  if (resRefresh1.statusCode !== 200) {
    throw new Error(`Refresh token rotation failed: ${JSON.stringify(resRefresh1.jsonData)}`);
  }
  
  const newRefreshToken = resRefresh1.cookiesList.refreshToken?.val;
  if (!newRefreshToken || newRefreshToken === activeRefreshToken) {
    console.error('Debug resRefresh1:', {
      statusCode: resRefresh1.statusCode,
      jsonData: resRefresh1.jsonData,
      cookiesList: resRefresh1.cookiesList,
    });
    throw new Error('Refresh token was not rotated with a new one.');
  }
  console.log('✔ Refresh token successfully rotated.');

  // Try to use the OLD (replayed) refresh token again to trigger replay attack prevention
  const reqReplay = createMockReq({}, { refreshToken: activeRefreshToken });
  const resReplay = createMockRes();
  
  await refreshToken(reqReplay, resReplay);
  
  if (resReplay.statusCode !== 401) {
    throw new Error(`Expected replay attack to return 401, got ${resReplay.statusCode}`);
  }
  
  if (!resReplay.jsonData.message.toLowerCase().includes('suspicious') && !resReplay.jsonData.message.toLowerCase().includes('revoked')) {
    throw new Error(`Unexpected replay attack response message: ${JSON.stringify(resReplay.jsonData)}`);
  }
  
  // Verify that ALL sessions for this user have been revoked
  const allSessionsAfterReplay = await UserSession.find({ userId: testUser._id });
  const activeCountAfterReplay = allSessionsAfterReplay.filter(s => !s.isRevoked).length;
  
  if (activeCountAfterReplay !== 0) {
    throw new Error(`Expected 0 active sessions after replay detection, but found ${activeCountAfterReplay} active sessions.`);
  }
  console.log('✔ Suspected replay attack successfully revoked ALL user sessions.');

  console.log('--- 5. Testing Impossible Travel Detection ---');
  // Clean login history for clean test
  await LoginEvent.deleteMany({ email: testEmail });
  
  // We record a successful login from New York, US IP.
  // Wait, let's look at resolveGeo logic in LoginRiskService:
  // If we pass an IP address, it tries to fetch from ip-api.com, or falls back to hash-based lookup.
  // Let's mock a success login event directly in the database to simulate impossible travel.
  // We insert a SUCCESS login event 5 seconds ago in US.
  const pastTime = new Date(Date.now() - 5000); // 5 seconds ago
  
  // We use two IP addresses that resolve to different coordinates.
  // US IP: '8.8.8.8' (resolves to United States via ip-api)
  // India IP: '1.1.1.1' (resolves to Australia or India)
  // Let's check what coordinates ip-api.com returns for '8.8.8.8' vs '1.1.1.1', or fallback coordinates.
  // Let's create a SUCCESS event for 8.8.8.8:
  await LoginEvent.create({
    email: testEmail,
    status: 'SUCCESS',
    ipAddress: '8.8.8.8',
    userAgent: 'Mozilla/5.5',
    riskLevel: 'LOW',
    createdAt: pastTime,
    organizationId: orgId,
  });

  // Evaluate risk for a login attempt from India IP '1.1.1.1' 5 seconds later
  const riskResult = await LoginRiskService.evaluateRisk({
    email: testEmail,
    ipAddress: '1.1.1.1',
    userAgent: 'Mozilla/5.5',
    organizationId: orgId.toString(),
  });

  console.log('Risk evaluation result:', {
    riskLevel: riskResult.riskLevel,
    factors: riskResult.factors,
    shouldBlock: riskResult.shouldBlock,
  });

  const travelFactor = riskResult.factors.find(f => f.toLowerCase().includes('impossible travel'));
  if (!travelFactor) {
    throw new Error('Impossible travel was not detected by risk evaluation!');
  }
  
  if (!riskResult.shouldBlock || riskResult.riskLevel !== 'CRITICAL') {
    throw new Error(`Expected risk block and CRITICAL risk level for impossible travel, got block=${riskResult.shouldBlock}, level=${riskResult.riskLevel}`);
  }
  
  console.log(`✔ Impossible travel successfully detected and blocked: ${travelFactor}`);

  console.log('--- Cleaning Up Test Data ---');
  await User.deleteMany({ email: testEmail });
  await Organization.deleteMany({ slug: testSlug });
  await OrganizationAuthConfig.deleteMany({ organizationId: orgId });
  await UserSession.deleteMany({ userId: testUser._id });
  await LoginEvent.deleteMany({ email: testEmail });

  console.log('🎉 ALL AUTHENTICATION SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
