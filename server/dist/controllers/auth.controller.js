"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.getMe = exports.impersonate = exports.revokeSession = exports.getUserSessions = exports.disableMfa = exports.enableMfa = exports.setupMfa = exports.refreshToken = exports.logout = exports.verifyMfa = exports.login = exports.getTenantConfig = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const crypto_1 = __importDefault(require("crypto"));
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const Organization_js_1 = require("../models/Organization.js");
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
const UserSession_js_1 = require("../models/UserSession.js");
const jwt_js_1 = require("../utils/jwt.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const PasswordService_js_1 = require("../domains/auth-engine/services/PasswordService.js");
const LoginRiskService_js_1 = require("../domains/auth-engine/services/LoginRiskService.js");
const totp_js_1 = require("../utils/totp.js");
const LoginEvent_js_1 = require("../domains/auth-engine/models/LoginEvent.js");
// Helper to perform concurrent session limit enforcement
async function createSessionAndRespond(user, org, req, res, risk) {
    const maxSessions = 3;
    // Cleanup expired user sessions
    await UserSession_js_1.UserSession.deleteMany({
        userId: user._id,
        expiresAt: { $lt: new Date() },
    });
    // Fetch current active sessions
    const activeSessions = await UserSession_js_1.UserSession.find({
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
    if (/chrome/i.test(userAgent))
        browser = 'Chrome';
    else if (/firefox/i.test(userAgent))
        browser = 'Firefox';
    else if (/safari/i.test(userAgent))
        browser = 'Safari';
    else if (/edge/i.test(userAgent))
        browser = 'Edge';
    if (/windows/i.test(userAgent))
        os = 'Windows';
    else if (/macintosh|mac os/i.test(userAgent))
        os = 'macOS';
    else if (/linux/i.test(userAgent))
        os = 'Linux';
    else if (/android/i.test(userAgent))
        os = 'Android';
    else if (/iphone|ipad/i.test(userAgent))
        os = 'iOS';
    const deviceInfo = `${browser} on ${os}`;
    const sessionId = new mongoose_1.default.Types.ObjectId();
    // Generate Refresh Token
    const refreshToken = (0, jwt_js_1.generateRefreshToken)({
        id: user.id,
        organizationId: org._id.toString(),
        sessionId: sessionId.toString(),
    });
    const refreshTokenHash = crypto_1.default.createHash('sha256').update(refreshToken).digest('hex');
    // Create database-backed user session
    await UserSession_js_1.UserSession.create({
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
    const accessToken = (0, jwt_js_1.generateAccessToken)({
        id: user.id,
        role: user.role,
        email: user.email,
        organizationId: org._id.toString(),
        sessionId: sessionId.toString(),
    });
    // Record SUCCESS login event
    await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
    await (0, auditLog_service_js_1.createAuditLog)('USER_LOGIN', `${user.name} (${user.role})`, 'AUTH', 'User Session', `Logged in from IP ${req.ip} (${deviceInfo})`, org._id);
    // Set Refresh Token as HttpOnly Cookie
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    const userObj = user.toObject();
    delete userObj.password;
    delete userObj.mfaSecret;
    delete userObj.backupCodes;
    res.status(200).json({ user: userObj, token: accessToken });
}
const getTenantConfig = async (req, res) => {
    try {
        const { slug } = req.params;
        const queryParam = (slug || req.query.slug || '').toString().toLowerCase().trim();
        if (!queryParam) {
            res.status(400).json({ message: 'Organization identifier is required' });
            return;
        }
        let org = await Organization_js_1.Organization.findOne({
            $or: [{ slug: queryParam }, { domain: queryParam }],
            isActive: true,
        });
        // Fallback logic for local development default tenants: 'tech' and 'ethicsecur'
        if (!org && (queryParam === 'tech' || queryParam === 'ethicsecur')) {
            org = await Organization_js_1.Organization.findOne({
                $or: [
                    { slug: 'tech' },
                    { slug: 'ethicsecur' },
                    { _id: new mongoose_1.default.Types.ObjectId('605c72ef1f77bcf86cd79000') }
                ],
                isActive: true,
            });
        }
        if (!org) {
            res.status(200).json({ notFound: true, message: 'Organization not found or deactivated' });
            return;
        }
        const authConfigs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({ organizationId: org._id, isEnabled: true });
        res.status(200).json({
            name: org.name,
            id: org._id,
            slug: org.slug,
            domain: org.domain,
            sector: org.sector,
            settings: org.settings,
            authProviders: authConfigs.map((c) => c.provider),
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTenantConfig = getTenantConfig;
const login = async (req, res) => {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password || !tenantSlug) {
        res.status(400).json({ message: 'Email, password, and organization code are required' });
        return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedTenant = tenantSlug.toLowerCase().trim();
    try {
        // 1. Resolve Organization strictly
        const org = await Organization_js_1.Organization.findOne({
            $or: [{ slug: normalizedTenant }, { domain: normalizedTenant }],
            isActive: true,
        });
        if (!org) {
            res.status(404).json({ message: 'Organization not found or inactive' });
            return;
        }
        // 2. Perform Login Risk Evaluation
        const risk = await LoginRiskService_js_1.LoginRiskService.evaluateRisk({
            email: normalizedEmail,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || '',
            organizationId: org._id.toString(),
        });
        if (risk.shouldBlock) {
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
        const user = await User_js_1.User.findOne({
            email: normalizedEmail,
            organizationId: org._id,
        }).select('+password +mfaSecret +backupCodes');
        if (!user) {
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
        // Check account temporary lockout
        if (user.isBlocked) {
            if (user.blockedUntil && user.blockedUntil > new Date()) {
                res.status(403).json({
                    message: `Account is temporarily locked. Try again after ${user.blockedUntil.toLocaleTimeString()}`,
                });
                return;
            }
            else {
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
        const { isValid, needsUpgrade } = await PasswordService_js_1.PasswordService.verifyAndCheckNeedsUpgrade(password, user.password);
        if (!isValid) {
            // Brute-force detection on user account
            const failedRecent = await LoginEvent_js_1.LoginEvent.countDocuments({
                email: user.email,
                status: 'FAILED',
                createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }, // last 15 min
            });
            if (failedRecent >= 4) {
                user.isBlocked = true;
                user.blockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins block
                await user.save();
                await (0, auditLog_service_js_1.createAuditLog)('USER_BLOCKED', user.email, 'AUTH', 'User Security', 'Account temporarily locked due to multiple login failures', org._id);
            }
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
            user.password = await PasswordService_js_1.PasswordService.hashPassword(password);
            await user.save();
        }
        // 5. MFA Routing Check
        if (user.mfaEnabled) {
            const mfaToken = (0, jwt_js_1.generateAccessToken)({
                id: user.id,
                role: user.role,
                email: user.email,
                organizationId: org._id.toString(),
                mfaPending: true,
            });
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.login = login;
const verifyMfa = async (req, res) => {
    try {
        const { mfaToken, code } = req.body;
        if (!mfaToken || !code) {
            res.status(400).json({ message: 'MFA token and verification code are required' });
            return;
        }
        const { verifyAccessToken } = await import('../utils/jwt.js');
        let decoded;
        try {
            decoded = verifyAccessToken(mfaToken);
        }
        catch (err) {
            res.status(401).json({ message: 'Invalid or expired MFA session token' });
            return;
        }
        if (!decoded.mfaPending) {
            res.status(400).json({ message: 'Invalid MFA flow payload' });
            return;
        }
        const user = await User_js_1.User.findById(decoded.id).select('+mfaSecret +backupCodes');
        if (!user || !user.isActive) {
            res.status(401).json({ message: 'User inactive or not found' });
            return;
        }
        const org = await Organization_js_1.Organization.findById(user.organizationId);
        if (!org || !org.isActive) {
            res.status(401).json({ message: 'Organization inactive or not found' });
            return;
        }
        const risk = await LoginRiskService_js_1.LoginRiskService.evaluateRisk({
            email: user.email,
            ipAddress: req.ip || '127.0.0.1',
            userAgent: req.headers['user-agent'] || '',
            organizationId: org._id.toString(),
        });
        let verified = false;
        let isBackup = false;
        if (user.mfaSecret && (0, totp_js_1.verifyTOTP)(user.mfaSecret, code)) {
            verified = true;
        }
        else if (user.backupCodes && user.backupCodes.includes(code)) {
            verified = true;
            isBackup = true;
            user.backupCodes = user.backupCodes.filter((c) => c !== code);
            await user.save();
        }
        if (!verified) {
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
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
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.verifyMfa = verifyMfa;
const logout = async (req, res) => {
    try {
        const sessionId = req.user?.sessionId;
        if (sessionId) {
            await UserSession_js_1.UserSession.findByIdAndUpdate(sessionId, { isRevoked: true });
        }
        if (req.user) {
            await (0, auditLog_service_js_1.createAuditLog)('USER_LOGOUT', req.user.email, 'AUTH', 'User Session', 'Logged out', req.user.organizationId);
        }
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        res.status(200).json({ message: 'Logged out successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.logout = logout;
const refreshToken = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token) {
            res.status(401).json({ message: 'Refresh token missing' });
            return;
        }
        const { verifyRefreshToken } = await import('../utils/jwt.js');
        let decoded;
        try {
            decoded = verifyRefreshToken(token);
        }
        catch (err) {
            res.status(401).json({ message: 'Invalid or expired refresh token' });
            return;
        }
        const session = await UserSession_js_1.UserSession.findById(decoded.sessionId);
        if (!session) {
            res.status(401).json({ message: 'Session not found' });
            return;
        }
        const currentHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        // Replay Attack Detection
        if (session.isRevoked || session.refreshTokenHash !== currentHash) {
            if (session.rotatedTokenHashes.includes(currentHash)) {
                // Replay attack suspected! Revoke all sessions for this user.
                session.isRevoked = true;
                await session.save();
                await UserSession_js_1.UserSession.updateMany({ userId: session.userId }, { isRevoked: true });
                const user = await User_js_1.User.findById(session.userId);
                if (user) {
                    await (0, auditLog_service_js_1.createAuditLog)('SECURITY_ALERT', user.email, 'AUTH', 'Token Replay', 'Refresh token replay attack detected. All active sessions revoked.', user.organizationId);
                }
                res.clearCookie('refreshToken', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                });
                res.status(401).json({
                    message: 'Suspicious session usage detected. Access revoked. Please log in again.',
                });
                return;
            }
            res.status(401).json({ message: 'Session has been revoked or expired' });
            return;
        }
        const user = await User_js_1.User.findById(session.userId);
        if (!user || !user.isActive) {
            res.status(401).json({ message: 'User inactive or not found' });
            return;
        }
        // Rotate token
        const newRefreshToken = (0, jwt_js_1.generateRefreshToken)({
            id: user.id,
            organizationId: user.organizationId.toString(),
            sessionId: session._id.toString(),
        });
        const newHash = crypto_1.default.createHash('sha256').update(newRefreshToken).digest('hex');
        session.rotatedTokenHashes.push(session.refreshTokenHash);
        session.refreshTokenHash = newHash;
        session.lastActivity = new Date();
        session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        await session.save();
        const accessToken = (0, jwt_js_1.generateAccessToken)({
            id: user.id,
            role: user.role,
            email: user.email,
            organizationId: user.organizationId.toString(),
            sessionId: session._id.toString(),
        });
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.status(200).json({ token: accessToken });
    }
    catch (error) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};
exports.refreshToken = refreshToken;
const setupMfa = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const user = await User_js_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const { secret, otpauthUrl } = (0, totp_js_1.generateTOTPSecret)(user.email);
        // Generate 8-digit backup codes
        const backupCodes = Array.from({ length: 8 }, () => crypto_1.default.randomBytes(4).toString('hex').toUpperCase());
        // Save temporarily without enabling until user successfully verifies first code
        user.mfaSecret = secret;
        user.backupCodes = backupCodes;
        await user.save();
        res.status(200).json({
            secret,
            otpauthUrl,
            backupCodes,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.setupMfa = setupMfa;
const enableMfa = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ message: 'Verification code is required' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id).select('+mfaSecret');
        if (!user || !user.mfaSecret) {
            res.status(400).json({ message: 'MFA setup is not initialized' });
            return;
        }
        if (!(0, totp_js_1.verifyTOTP)(user.mfaSecret, code)) {
            res.status(400).json({ message: 'Invalid verification code' });
            return;
        }
        user.mfaEnabled = true;
        await user.save();
        await (0, auditLog_service_js_1.createAuditLog)('MFA_ENABLED', user.email, 'SECURITY', 'MFA', 'Multi-factor authentication enabled', user.organizationId);
        res.status(200).json({ message: 'MFA enabled successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.enableMfa = enableMfa;
const disableMfa = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ message: 'Verification code is required' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id).select('+mfaSecret');
        if (!user || !user.mfaEnabled || !user.mfaSecret) {
            res.status(400).json({ message: 'MFA is not enabled' });
            return;
        }
        if (!(0, totp_js_1.verifyTOTP)(user.mfaSecret, code)) {
            res.status(400).json({ message: 'Invalid verification code' });
            return;
        }
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        user.backupCodes = undefined;
        await user.save();
        await (0, auditLog_service_js_1.createAuditLog)('MFA_DISABLED', user.email, 'SECURITY', 'MFA', 'Multi-factor authentication disabled', user.organizationId);
        res.status(200).json({ message: 'MFA disabled successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.disableMfa = disableMfa;
const getUserSessions = async (req, res) => {
    try {
        const sessions = await UserSession_js_1.UserSession.find({
            userId: req.user?.id,
            isRevoked: false,
        }).sort({ lastActivity: -1 });
        res.status(200).json({ sessions });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getUserSessions = getUserSessions;
const revokeSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            res.status(400).json({ message: 'Session ID is required' });
            return;
        }
        const session = await UserSession_js_1.UserSession.findOne({
            _id: sessionId,
            userId: req.user?.id,
        });
        if (!session) {
            res.status(404).json({ message: 'Session not found' });
            return;
        }
        session.isRevoked = true;
        await session.save();
        await (0, auditLog_service_js_1.createAuditLog)('USER_SESSION_REVOKED', req.user?.email || 'Unknown', 'AUTH', 'User Session', `Session ${sessionId} was manually revoked`, req.user?.organizationId);
        res.status(200).json({ message: 'Session revoked successfully' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.revokeSession = revokeSession;
const impersonate = async (req, res) => {
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
        const targetUser = await User_js_1.User.findById(userId);
        if (!targetUser) {
            res.status(404).json({ message: 'Target user not found.' });
            return;
        }
        const accessToken = (0, jwt_js_1.generateAccessToken)({
            id: targetUser.id,
            role: targetUser.role,
            email: targetUser.email,
            organizationId: targetUser.organizationId.toString(),
            isImpersonated: true,
            originalAdminId: req.user.id,
        });
        await (0, auditLog_service_js_1.createAuditLog)('IMPERSONATION_START', req.user.email, 'AUTH', 'Impersonation', `Super Admin ${req.user.email} started impersonating user ${targetUser.email}`, req.user.organizationId);
        res.status(200).json({
            message: `Successfully impersonating ${targetUser.name}`,
            token: accessToken,
            user: targetUser,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.impersonate = impersonate;
const getMe = async (req, res) => {
    try {
        const user = await User_js_1.User.findById(req.user?.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.status(200).json({ user });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getMe = getMe;
const updateMe = async (req, res) => {
    try {
        const { profileImage, name, phone, address, emergencyContact } = req.body;
        const user = await User_js_1.User.findById(req.user?.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (profileImage)
            user.profileImage = profileImage;
        if (name)
            user.name = name;
        await user.save();
        if (user.employeeId) {
            const updateData = { profileImage, fullName: name };
            if (phone)
                updateData.phone = phone;
            if (address)
                updateData.address = address;
            if (emergencyContact)
                updateData.emergencyContact = emergencyContact;
            await Employee_js_1.Employee.findByIdAndUpdate(user.employeeId, updateData);
        }
        res.status(200).json({ user });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateMe = updateMe;
