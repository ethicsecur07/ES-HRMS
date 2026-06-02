import { Request, Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Organization } from '../models/Organization.js';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { UserSession } from '../models/UserSession.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { PasswordService } from '../domains/auth-engine/services/PasswordService.js';
import { LoginRiskService } from '../domains/auth-engine/services/LoginRiskService.js';
import { generateTOTPSecret, verifyTOTP } from '../utils/totp.js';
import { AuthRequest } from '../types/index.js';
import { LoginEvent } from '../domains/auth-engine/models/LoginEvent.js';

// Helper to perform concurrent session limit enforcement
async function createSessionAndRespond(
  user: any,
  org: any,
  req: Request,
  res: Response,
  risk: any
): Promise<void> {
  const maxSessions = 3;

  // Cleanup expired user sessions
  await UserSession.deleteMany({
    userId: user._id,
    expiresAt: { $lt: new Date() },
  });

  // Fetch current active sessions
  const activeSessions = await UserSession.find({
    userId: user._id,
    isRevoked: false,
  }).sort({ lastActivity: 1 });

  if (activeSessions.length >= maxSessions) {
    // Revoke the oldest sessions to remain under the limit
    const overage = activeSessions.length - maxSessions + 1;
    const sessionsToRevoke = activeSessions.slice(0, overage);
    for (const session of sessionsToRevoke) {
      session.isRevoked = true;
      await session.save();
    }
  }

  // Parse User-Agent
  const userAgent = req.headers['user-agent'] || '';
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  if (/chrome/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent)) browser = 'Safari';
  else if (/edge/i.test(userAgent)) browser = 'Edge';

  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad/i.test(userAgent)) os = 'iOS';

  const deviceInfo = `${browser} on ${os}`;
  const sessionId = new mongoose.Types.ObjectId();

  // Generate Refresh Token
  const refreshToken = generateRefreshToken({
    id: user.id,
    organizationId: org._id.toString(),
    sessionId: sessionId.toString(),
  });

  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Create database-backed user session
  await UserSession.create({
    _id: sessionId,
    userId: user._id,
    organizationId: org._id,
    refreshTokenHash,
    deviceInfo,
    ipAddress: req.ip,
    browser,
    os,
    location: risk.country || 'Unknown',
    lastActivity: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  // Generate Access Token
  const accessToken = generateAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
    organizationId: org._id.toString(),
    employeeId: user.employeeId?.toString(),
    sessionId: sessionId.toString(),
  });

  // Record SUCCESS login event
  await LoginRiskService.recordEvent({
    userId: user._id,
    organizationId: org._id,
    email: user.email,
    status: 'SUCCESS',
    ipAddress: req.ip,
    userAgent,
    location: risk.country || 'Unknown',
    riskLevel: risk.riskLevel,
    riskFactors: risk.factors,
    sessionId: sessionId.toString(),
  });

  user.lastLogin = new Date();
  await user.save();

  // Audit logging
  await createAuditLog(
    'USER_LOGIN',
    `${user.name} (${user.role})`,
    'AUTH',
    'User Session',
    `Logged in from IP ${req.ip} (${deviceInfo})`,
    org._id
  );

  // Set Refresh Token as HttpOnly Cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.mfaSecret;
  delete userObj.backupCodes;

  res.status(200).json({ user: userObj, token: accessToken });
}

export const getTenantConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const queryParam = (slug || req.query.slug || '').toString().toLowerCase().trim();
    if (!queryParam) {
      res.status(400).json({ message: 'Organization identifier is required' });
      return;
    }

    let org = await Organization.findOne({
      $or: [{ slug: queryParam }, { domain: queryParam }],
      isActive: true,
    });

    // Fallback logic for local development default tenants: 'tech' and 'ethicsecur'
    if (!org && (queryParam === 'tech' || queryParam === 'ethicsecur')) {
      org = await Organization.findOne({
        $or: [
          { slug: 'tech' },
          { slug: 'ethicsecur' },
          { _id: new mongoose.Types.ObjectId('605c72ef1f77bcf86cd79000') }
        ],
        isActive: true,
      });
    }

    if (!org) {
      res.status(200).json({ notFound: true, message: 'Organization not found or deactivated' });
      return;
    }

    const authConfigs = await OrganizationAuthConfig.find({ organizationId: org._id, isEnabled: true });
    res.status(200).json({
      name: org.name,
      id: org._id,
      slug: org.slug,
      domain: org.domain,
      sector: org.sector,
      settings: org.settings,
      authProviders: authConfigs.map((c) => c.provider),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password, tenantSlug } = req.body;

  if (!email || !password || !tenantSlug) {
    res.status(400).json({ message: 'Email, password, and organization code are required' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedTenant = tenantSlug.toLowerCase().trim();

  try {
    // 1. Resolve Organization strictly
    const org = await Organization.findOne({
      $or: [{ slug: normalizedTenant }, { domain: normalizedTenant }],
      isActive: true,
    });

    if (!org) {
      res.status(404).json({ message: 'Organization not found or inactive' });
      return;
    }

    // 2. Perform Login Risk Evaluation
    const risk = await LoginRiskService.evaluateRisk({
      email: normalizedEmail,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      organizationId: org._id.toString(),
    });

    if (risk.shouldBlock) {
      await LoginRiskService.recordEvent({
        email: normalizedEmail,
        status: 'BLOCKED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        riskLevel: 'CRITICAL',
        riskFactors: risk.factors,
        organizationId: org._id,
        failureReason: 'Security risk block',
      });
      res.status(403).json({ message: 'Access blocked due to suspicious activity patterns.' });
      return;
    }

    // 3. Find User
    const user = await User.findOne({
      email: normalizedEmail,
      organizationId: org._id,
    }).select('+password +mfaSecret +backupCodes');

    if (!user) {
      await LoginRiskService.recordEvent({
        email: normalizedEmail,
        status: 'FAILED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
        organizationId: org._id,
        failureReason: 'User not found',
      });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: 'Account is deactivated. Please contact HR.' });
      return;
    }

    if (user.isLoginApproved === false) {
      res.status(403).json({ message: 'Your login request has not been approved by an administrator yet. Please contact your organization.' });
      return;
    }

    // Check account temporary lockout
    if (user.isBlocked) {
      if (user.blockedUntil && user.blockedUntil > new Date()) {
        res.status(403).json({
          message: `Account is temporarily locked. Try again after ${user.blockedUntil.toLocaleTimeString()}`,
        });
        return;
      } else {
        user.isBlocked = false;
        user.blockedUntil = undefined;
        await user.save();
      }
    }

    if (!user.password) {
      res.status(401).json({ message: 'Invalid credentials or SSO user attempting local login' });
      return;
    }

    // 4. Verify password and check legacy hashing
    const { isValid, needsUpgrade } = await PasswordService.verifyAndCheckNeedsUpgrade(
      password,
      user.password
    );

    if (!isValid) {
      // Brute-force detection on user account
      const failedRecent = await LoginEvent.countDocuments({
        email: user.email,
        status: 'FAILED',
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // last 15 min
      });

      if (failedRecent >= 4) {
        user.isBlocked = true;
        user.blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins block
        await user.save();
        await createAuditLog(
          'USER_BLOCKED',
          user.email,
          'AUTH',
          'User Security',
          'Account temporarily locked due to multiple login failures',
          org._id
        );
      }

      await LoginRiskService.recordEvent({
        userId: user._id,
        organizationId: org._id,
        email: user.email,
        status: 'FAILED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
        failureReason: 'Invalid password',
      });

      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Silently migrate password from legacy bcrypt to Argon2
    if (needsUpgrade) {
      user.password = await PasswordService.hashPassword(password);
      await user.save();
    }

    // 5. MFA Routing Check
    if (user.mfaEnabled) {
      const mfaToken = generateAccessToken({
        id: user.id,
        role: user.role,
        email: user.email,
        organizationId: org._id.toString(),
        employeeId: user.employeeId?.toString(),
        mfaPending: true,
      });

      await LoginRiskService.recordEvent({
        userId: user._id,
        organizationId: org._id,
        email: user.email,
        status: 'MFA_REQUIRED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
      });

      res.status(200).json({ mfaRequired: true, mfaToken });
      return;
    }

    // 6. Complete Session Establishment
    await createSessionAndRespond(user, org, req, res, risk);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyMfa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      res.status(400).json({ message: 'MFA token and verification code are required' });
      return;
    }

    const { verifyAccessToken } = await import('../utils/jwt.js');
    let decoded: any;
    try {
      decoded = verifyAccessToken(mfaToken);
    } catch (err) {
      res.status(401).json({ message: 'Invalid or expired MFA session token' });
      return;
    }

    if (!decoded.mfaPending) {
      res.status(400).json({ message: 'Invalid MFA flow payload' });
      return;
    }

    const user = await User.findById(decoded.id).select('+mfaSecret +backupCodes');
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'User inactive or not found' });
      return;
    }

    const org = await Organization.findById(user.organizationId);
    if (!org || !org.isActive) {
      res.status(401).json({ message: 'Organization inactive or not found' });
      return;
    }

    const risk = await LoginRiskService.evaluateRisk({
      email: user.email,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      organizationId: org._id.toString(),
    });

    let verified = false;
    let isBackup = false;

    if (user.mfaSecret && verifyTOTP(user.mfaSecret, code)) {
      verified = true;
    } else if (user.backupCodes && user.backupCodes.includes(code)) {
      verified = true;
      isBackup = true;
      user.backupCodes = user.backupCodes.filter((c: string) => c !== code);
      await user.save();
    }

    if (!verified) {
      await LoginRiskService.recordEvent({
        userId: user._id,
        organizationId: org._id,
        email: user.email,
        status: 'MFA_FAILED',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        riskLevel: risk.riskLevel,
        riskFactors: risk.factors,
        failureReason: 'Invalid code',
      });
      res.status(401).json({ message: 'Invalid verification code' });
      return;
    }

    await createSessionAndRespond(user, org, req, res, risk);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await UserSession.findByIdAndUpdate(sessionId, { isRevoked: true });
    }

    if (req.user) {
      await createAuditLog(
        'USER_LOGOUT',
        req.user.email,
        'AUTH',
        'User Session',
        'Logged out',
        req.user.organizationId
      );
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    });

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ message: 'Refresh token missing' });
      return;
    }

    const { verifyRefreshToken } = await import('../utils/jwt.js');
    let decoded: any;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const session = await UserSession.findById(decoded.sessionId);
    if (!session) {
      res.status(401).json({ message: 'Session not found' });
      return;
    }

    const currentHash = crypto.createHash('sha256').update(token).digest('hex');

    // Replay Attack Detection
    if (session.isRevoked || session.refreshTokenHash !== currentHash) {
      if (session.rotatedTokenHashes.includes(currentHash)) {
        // Replay attack suspected! Revoke all sessions for this user.
        session.isRevoked = true;
        await session.save();

        await UserSession.updateMany({ userId: session.userId }, { isRevoked: true });

        const user = await User.findById(session.userId);
        if (user) {
          await createAuditLog(
            'SECURITY_ALERT',
            user.email,
            'AUTH',
            'Token Replay',
            'Refresh token replay attack detected. All active sessions revoked.',
            user.organizationId
          );
        }

        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        res.status(401).json({
          message: 'Suspicious session usage detected. Access revoked. Please log in again.',
        });
        return;
      }

      res.status(401).json({ message: 'Session has been revoked or expired' });
      return;
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ message: 'User inactive or not found' });
      return;
    }

    // Rotate token
    const newRefreshToken = generateRefreshToken({
      id: user.id,
      organizationId: user.organizationId.toString(),
      sessionId: session._id.toString(),
    });

    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

    session.rotatedTokenHashes.push(session.refreshTokenHash);
    session.refreshTokenHash = newHash;
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await session.save();

    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      email: user.email,
      organizationId: user.organizationId.toString(),
      employeeId: user.employeeId?.toString(),
      sessionId: session._id.toString(),
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ token: accessToken });
  } catch (error: any) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};

export const setupMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { secret, otpauthUrl } = generateTOTPSecret(user.email);

    // Generate 8-digit backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Save temporarily without enabling until user successfully verifies first code
    user.mfaSecret = secret;
    user.backupCodes = backupCodes;
    await user.save();

    res.status(200).json({
      secret,
      otpauthUrl,
      backupCodes,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const enableMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ message: 'Verification code is required' });
      return;
    }

    const user = await User.findById(req.user?.id).select('+mfaSecret');
    if (!user || !user.mfaSecret) {
      res.status(400).json({ message: 'MFA setup is not initialized' });
      return;
    }

    if (!verifyTOTP(user.mfaSecret, code)) {
      res.status(400).json({ message: 'Invalid verification code' });
      return;
    }

    user.mfaEnabled = true;
    await user.save();

    await createAuditLog(
      'MFA_ENABLED',
      user.email,
      'SECURITY',
      'MFA',
      'Multi-factor authentication enabled',
      user.organizationId
    );

    res.status(200).json({ message: 'MFA enabled successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const disableMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ message: 'Verification code is required' });
      return;
    }

    const user = await User.findById(req.user?.id).select('+mfaSecret');
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      res.status(400).json({ message: 'MFA is not enabled' });
      return;
    }

    if (!verifyTOTP(user.mfaSecret, code)) {
      res.status(400).json({ message: 'Invalid verification code' });
      return;
    }

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.backupCodes = undefined;
    await user.save();

    await createAuditLog(
      'MFA_DISABLED',
      user.email,
      'SECURITY',
      'MFA',
      'Multi-factor authentication disabled',
      user.organizationId
    );

    res.status(200).json({ message: 'MFA disabled successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sessions = await UserSession.find({
      userId: req.user?.id,
      isRevoked: false,
    }).sort({ lastActivity: -1 });

    res.status(200).json({ sessions });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ message: 'Session ID is required' });
      return;
    }

    const session = await UserSession.findOne({
      _id: sessionId,
      userId: req.user?.id,
    });

    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    session.isRevoked = true;
    await session.save();

    await createAuditLog(
      'USER_SESSION_REVOKED',
      req.user?.email || 'Unknown',
      'AUTH',
      'User Session',
      `Session ${sessionId} was manually revoked`,
      req.user?.organizationId
    );

    res.status(200).json({ message: 'Session revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const impersonate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ message: 'Forbidden. Only Super Admins can impersonate users.' });
      return;
    }
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ message: 'User ID is required for impersonation.' });
      return;
    }
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      res.status(404).json({ message: 'Target user not found.' });
      return;
    }

    const accessToken = generateAccessToken({
      id: targetUser.id,
      role: targetUser.role,
      email: targetUser.email,
      organizationId: targetUser.organizationId.toString(),
      employeeId: targetUser.employeeId?.toString(),
      isImpersonated: true,
      originalAdminId: req.user.id,
    });

    await createAuditLog(
      'IMPERSONATION_START',
      req.user.email,
      'AUTH',
      'Impersonation',
      `Super Admin ${req.user.email} started impersonating user ${targetUser.email}`,
      req.user.organizationId
    );

    res.status(200).json({
      message: `Successfully impersonating ${targetUser.name}`,
      token: accessToken,
      user: targetUser,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { profileImage, name, phone, address, emergencyContact } = req.body;
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (profileImage) user.profileImage = profileImage;
    if (name) user.name = name;
    await user.save();

    if (user.employeeId) {
      const updateData: any = { profileImage, fullName: name };
      if (phone) updateData.phone = phone;
      if (address) updateData.address = address;
      if (emergencyContact) updateData.emergencyContact = emergencyContact;
      await Employee.findByIdAndUpdate(user.employeeId, updateData);
    }

    res.status(200).json({ user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, organizationName, organizationSlug, organizationSector } = req.body;

  if (!name || !email || !password || !organizationName || !organizationSlug || !organizationSector) {
    res.status(400).json({ message: 'All registration fields are required.' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSlug = organizationSlug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalizedSlug) {
    res.status(400).json({ message: 'Invalid organization slug format.' });
    return;
  }

  try {
    // 1. Password Strength Validation
    const strength = PasswordService.validateStrength(password);
    if (!strength.isValid) {
      res.status(400).json({ message: strength.message });
      return;
    }

    // 2. Check if Org Slug is already taken
    const existingOrg = await Organization.findOne({ slug: normalizedSlug });
    if (existingOrg) {
      res.status(400).json({ message: 'This organization slug is already registered. Please choose a different one.' });
      return;
    }

    // 3. Perform Signup Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create Organization
      const organization = new Organization({
        name: organizationName,
        slug: normalizedSlug,
        sector: organizationSector,
        isActive: true,
        settings: {
          adminEmail: normalizedEmail,
          theme: 'dark',
        },
      });
      await organization.save({ session });

      // Hash Password using Argon2
      const hashedPassword = await PasswordService.hashPassword(password);

      // Create Admin User
      const adminUser = new User({
        organizationId: organization._id,
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isLoginApproved: true,
      });
      await adminUser.save({ session });

      // Create initial operational Employee profile for Admin
      const employee = new Employee({
        organizationId: organization._id,
        employeeCode: 'EMP-1001',
        fullName: name,
        email: normalizedEmail,
        phone: '0000000000',
        department: 'HR',
        designation: 'HR Manager',
        joiningDate: new Date(),
        salary: 0,
        address: 'Office Address',
        emergencyContact: {
          name: 'Self',
          relationship: 'Self',
          phone: '0000000000',
        },
        isActive: true,
      });
      await employee.save({ session });

      // Link User to Employee
      adminUser.employeeId = employee._id as any;
      await adminUser.save({ session });

      // Sync Default Permissions and Roles for the new Tenant
      const { PermissionSyncService } = await import('../domains/organization/services/PermissionSyncService.js');
      await PermissionSyncService.syncForTenant(organization._id as any, session as any);

      // Audit log creation
      await createAuditLog(
        'ORGANIZATION_SIGNUP',
        normalizedEmail,
        'AUTH',
        'Organization',
        `Registered new organization "${organizationName}" with slug "${normalizedSlug}" and administrator "${name}"`,
        organization._id
      );

      await session.commitTransaction();

      res.status(201).json({
        success: true,
        message: 'Organization and administrator account successfully registered!',
        organizationId: organization._id,
        slug: normalizedSlug,
      });
    } catch (transactionError) {
      await session.abortTransaction();
      throw transactionError;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

