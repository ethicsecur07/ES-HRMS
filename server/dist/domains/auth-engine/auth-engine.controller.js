"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyLoginHistory = exports.getLoginEvents = exports.deleteSessionPolicy = exports.updateSessionPolicy = exports.createSessionPolicy = exports.listSessionPolicies = exports.removeProvider = exports.registerProvider = exports.listProviders = exports.removeDevice = exports.blockDevice = exports.trustDevice = exports.getDevices = exports.disableMFA = exports.getMFAStatus = exports.verifyRecoveryCode = exports.verifyMFA = exports.setupMFA = exports.handleSSOCallback = exports.initiateSSO = exports.getOrgProviders = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ProviderRegistry_js_1 = require("./services/ProviderRegistry.js");
const MFAService_js_1 = require("./services/MFAService.js");
const DeviceManagementService_js_1 = require("./services/DeviceManagementService.js");
const LoginRiskService_js_1 = require("./services/LoginRiskService.js");
const SessionPolicyService_js_1 = require("./services/SessionPolicyService.js");
const User_js_1 = require("../../models/User.js");
const Organization_js_1 = require("../../models/Organization.js");
const jwt_js_1 = require("../../utils/jwt.js");
const auditLog_service_js_1 = require("../../services/auditLog.service.js");
// ============================================================
// SSO ENDPOINTS
// ============================================================
/**
 * GET /api/v2/auth/sso/providers/:orgSlug
 * List available SSO providers for an organization.
 */
const getOrgProviders = async (req, res) => {
    try {
        const { orgSlug } = req.params;
        const org = await Organization_js_1.Organization.findOne({ slug: orgSlug.toLowerCase().trim(), isActive: true });
        if (!org) {
            res.status(404).json({ success: false, message: 'Organization not found' });
            return;
        }
        const providers = await ProviderRegistry_js_1.ProviderRegistry.getProviders(org._id.toString());
        res.status(200).json({
            success: true,
            data: providers.map((p) => ({
                type: p.provider,
                name: p.displayName,
                isPrimary: p.isPrimary,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOrgProviders = getOrgProviders;
/**
 * GET /api/v2/auth/sso/initiate/:orgSlug/:providerType
 * Initiate SSO login — redirects user to the IDP.
 */
const initiateSSO = async (req, res) => {
    try {
        const { orgSlug, providerType } = req.params;
        const org = await Organization_js_1.Organization.findOne({ slug: orgSlug.toLowerCase().trim(), isActive: true });
        if (!org) {
            res.status(404).json({ success: false, message: 'Organization not found' });
            return;
        }
        const providerKey = (providerType || '').toUpperCase() === 'SAML2' ? 'SAML' : (providerType || '').toUpperCase();
        const provider = await ProviderRegistry_js_1.ProviderRegistry.getProviderByType(org._id.toString(), providerKey);
        if (!provider) {
            res.status(404).json({ success: false, message: `Provider ${providerType} not configured for this organization` });
            return;
        }
        const adapter = ProviderRegistry_js_1.ProviderRegistry.createAdapter(provider);
        const state = crypto_1.default.randomUUID(); // In production: store in session/Redis
        const authUrl = adapter.getAuthorizationUrl(state);
        res.status(200).json({
            success: true,
            data: { authorizationUrl: authUrl, state },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.initiateSSO = initiateSSO;
/**
 * POST /api/v2/auth/sso/callback
 * Handle SSO callback from IDP.
 */
const handleSSOCallback = async (req, res) => {
    try {
        const { code, state, orgSlug, providerType, SAMLResponse } = req.body;
        const org = await Organization_js_1.Organization.findOne({ slug: orgSlug?.toLowerCase().trim(), isActive: true });
        if (!org) {
            res.status(404).json({ success: false, message: 'Organization not found' });
            return;
        }
        const providerKey = (providerType || 'SAML').toUpperCase() === 'SAML2' ? 'SAML' : (providerType || 'SAML').toUpperCase();
        const provider = await ProviderRegistry_js_1.ProviderRegistry.getProviderByType(org._id.toString(), providerKey);
        if (!provider) {
            res.status(404).json({ success: false, message: 'Provider not configured' });
            return;
        }
        const adapter = ProviderRegistry_js_1.ProviderRegistry.createAdapter(provider);
        const authResult = await adapter.handleCallback(SAMLResponse || code);
        if (!authResult.profile.email) {
            res.status(400).json({ success: false, message: 'No email returned from identity provider' });
            return;
        }
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const userAgent = req.headers['user-agent'] || '';
        // Risk assessment
        const risk = await LoginRiskService_js_1.LoginRiskService.evaluateRisk({
            email: authResult.profile.email,
            ipAddress,
            userAgent,
            organizationId: org._id.toString(),
        });
        if (risk.shouldBlock) {
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
                email: authResult.profile.email,
                organizationId: org._id,
                status: 'BLOCKED',
                provider: providerType,
                ipAddress,
                userAgent,
                riskLevel: risk.riskLevel,
                riskFactors: risk.factors,
                failureReason: 'Login blocked due to high risk',
            });
            res.status(403).json({ success: false, message: 'Login blocked due to suspicious activity' });
            return;
        }
        // Session policy IP check
        const sessionPolicy = await SessionPolicyService_js_1.SessionPolicyService.getPolicy(org._id.toString());
        if (sessionPolicy) {
            const ipCheck = SessionPolicyService_js_1.SessionPolicyService.validateIP(sessionPolicy, ipAddress);
            if (!ipCheck.allowed) {
                res.status(403).json({ success: false, message: ipCheck.reason });
                return;
            }
        }
        // Find or auto-provision user
        let user = await User_js_1.User.findOne({
            email: { $regex: new RegExp(`^${authResult.profile.email}$`, 'i') },
            organizationId: org._id,
        });
        // Map role from Azure AD App Roles if available
        let resolvedRole = null;
        if (authResult.profile.roles && authResult.profile.roles.length > 0) {
            const rolesUpper = authResult.profile.roles.map((r) => r.toUpperCase());
            if (rolesUpper.includes('ADMIN'))
                resolvedRole = 'ADMIN';
            else if (rolesUpper.includes('HR'))
                resolvedRole = 'HR';
            else if (rolesUpper.includes('MANAGER'))
                resolvedRole = 'MANAGER';
            else if (rolesUpper.includes('TEAM_LEAD') || rolesUpper.includes('TEAMLEAD'))
                resolvedRole = 'TEAM_LEAD';
            else if (rolesUpper.includes('EMPLOYEE'))
                resolvedRole = 'EMPLOYEE';
        }
        if (user) {
            // Dynamic updates on login
            user.name = authResult.profile.name || user.name;
            if (resolvedRole) {
                user.role = resolvedRole;
            }
            if (authResult.profile.avatar) {
                user.profileImage = authResult.profile.avatar;
            }
            user.ssoData = {
                provider: providerType,
                azureRoles: authResult.profile.roles || [],
                mappedRole: resolvedRole || undefined,
                jobTitle: authResult.profile.jobTitle || undefined,
                department: authResult.profile.department || undefined,
                lastSyncedAt: new Date()
            };
            await user.save();
        }
        else if (provider.autoProvision) {
            user = await User_js_1.User.create({
                organizationId: org._id,
                name: authResult.profile.name,
                email: authResult.profile.email,
                role: (resolvedRole || provider.defaultRoleCode || 'EMPLOYEE'),
                isActive: true,
                profileImage: authResult.profile.avatar,
                ssoData: {
                    provider: providerType,
                    azureRoles: authResult.profile.roles || [],
                    mappedRole: resolvedRole || undefined,
                    jobTitle: authResult.profile.jobTitle || undefined,
                    department: authResult.profile.department || undefined,
                    lastSyncedAt: new Date()
                }
            });
            await (0, auditLog_service_js_1.createAuditLog)('USER_AUTO_PROVISIONED', `${user.name} via ${providerType} SSO`, 'AUTH', 'User Account', `Auto-provisioned from ${providerType} with role ${user.role}`, org._id);
        }
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'No account found. Contact your administrator to enable SSO auto-provisioning.',
            });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ success: false, message: 'Account is deactivated' });
            return;
        }
        // Register device
        const { device, isNewDevice } = await DeviceManagementService_js_1.DeviceManagementService.registerDevice({
            userId: user._id.toString(),
            organizationId: org._id.toString(),
            userAgent,
            ipAddress,
        });
        // Check MFA requirement
        const mfaRequired = await MFAService_js_1.MFAService.isRequired(user._id.toString(), org._id.toString());
        if (mfaRequired) {
            // Return a partial token that requires MFA verification
            const mfaToken = (0, jwt_js_1.generateToken)({
                id: user._id.toString(),
                role: user.role,
                email: user.email,
                organizationId: org._id.toString(),
                employeeId: user.employeeId?.toString(),
                mfaPending: true,
            });
            await LoginRiskService_js_1.LoginRiskService.recordEvent({
                userId: user._id,
                email: user.email,
                organizationId: org._id,
                status: 'MFA_REQUIRED',
                provider: providerType,
                ipAddress,
                userAgent,
                deviceFingerprint: device.fingerprint,
                riskLevel: risk.riskLevel,
                riskFactors: risk.factors,
            });
            res.status(200).json({
                success: true,
                mfaRequired: true,
                mfaToken,
                mfaMethods: (await MFAService_js_1.MFAService.getStatus(user._id.toString(), org._id.toString()))?.methods,
            });
            return;
        }
        // Issue full session token
        user.lastLogin = new Date();
        await user.save();
        const token = (0, jwt_js_1.generateToken)({
            id: user._id.toString(),
            role: user.role,
            email: user.email,
            organizationId: org._id.toString(),
            employeeId: user.employeeId?.toString(),
        });
        await LoginRiskService_js_1.LoginRiskService.recordEvent({
            userId: user._id,
            email: user.email,
            organizationId: org._id,
            status: 'SUCCESS',
            provider: providerType,
            ipAddress,
            userAgent,
            deviceFingerprint: device.fingerprint,
            riskLevel: risk.riskLevel,
            riskFactors: risk.factors,
        });
        await (0, auditLog_service_js_1.createAuditLog)('SSO_LOGIN', `${user.name} via ${providerType}`, 'AUTH', 'User Session', `SSO login from IP ${ipAddress} (Risk: ${risk.riskLevel})`, org._id);
        res.status(200).json({
            success: true,
            data: {
                user,
                token,
                provider: providerType,
                isNewDevice,
                riskLevel: risk.riskLevel,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.handleSSOCallback = handleSSOCallback;
// ============================================================
// MFA ENDPOINTS
// ============================================================
/**
 * POST /api/v2/auth/mfa/setup
 */
const setupMFA = async (req, res) => {
    try {
        const { method } = req.body;
        const result = await MFAService_js_1.MFAService.setupMFA(req.user.id, req.user.organizationId, method || 'TOTP');
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.setupMFA = setupMFA;
/**
 * POST /api/v2/auth/mfa/verify
 */
const verifyMFA = async (req, res) => {
    try {
        const { code, method } = req.body;
        const isValid = await MFAService_js_1.MFAService.verify(req.user.id, req.user.organizationId, code, method);
        if (!isValid) {
            res.status(401).json({ success: false, message: 'Invalid MFA code' });
            return;
        }
        // Issue full token (if this was an MFA challenge)
        const token = (0, jwt_js_1.generateToken)({
            id: req.user.id,
            role: req.user.role,
            email: req.user.email,
            organizationId: req.user.organizationId,
            employeeId: req.user.employeeId,
        });
        res.status(200).json({ success: true, data: { verified: true, token } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.verifyMFA = verifyMFA;
/**
 * POST /api/v2/auth/mfa/recovery
 */
const verifyRecoveryCode = async (req, res) => {
    try {
        const { code } = req.body;
        const isValid = await MFAService_js_1.MFAService.verifyRecoveryCode(req.user.id, req.user.organizationId, code);
        if (!isValid) {
            res.status(401).json({ success: false, message: 'Invalid recovery code' });
            return;
        }
        const token = (0, jwt_js_1.generateToken)({
            id: req.user.id,
            role: req.user.role,
            email: req.user.email,
            organizationId: req.user.organizationId,
            employeeId: req.user.employeeId,
        });
        res.status(200).json({ success: true, data: { verified: true, token } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.verifyRecoveryCode = verifyRecoveryCode;
/**
 * GET /api/v2/auth/mfa/status
 */
const getMFAStatus = async (req, res) => {
    try {
        const status = await MFAService_js_1.MFAService.getStatus(req.user.id, req.user.organizationId);
        res.status(200).json({ success: true, data: status });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMFAStatus = getMFAStatus;
/**
 * DELETE /api/v2/auth/mfa/disable
 */
const disableMFA = async (req, res) => {
    try {
        await MFAService_js_1.MFAService.disableMFA(req.user.id, req.user.organizationId);
        await (0, auditLog_service_js_1.createAuditLog)('MFA_DISABLED', req.user.email, 'AUTH', 'MFA', 'MFA disabled by user', req.user.organizationId);
        res.status(200).json({ success: true, message: 'MFA disabled' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.disableMFA = disableMFA;
// ============================================================
// DEVICE MANAGEMENT ENDPOINTS
// ============================================================
/**
 * GET /api/v2/auth/devices
 */
const getDevices = async (req, res) => {
    try {
        const devices = await DeviceManagementService_js_1.DeviceManagementService.getUserDevices(req.user.id);
        res.status(200).json({ success: true, data: devices });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDevices = getDevices;
/**
 * PUT /api/v2/auth/devices/:deviceId/trust
 */
const trustDevice = async (req, res) => {
    try {
        const device = await DeviceManagementService_js_1.DeviceManagementService.trustDevice(req.user.id, req.params.deviceId);
        if (!device) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        res.status(200).json({ success: true, data: device });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.trustDevice = trustDevice;
/**
 * PUT /api/v2/auth/devices/:deviceId/block
 */
const blockDevice = async (req, res) => {
    try {
        const device = await DeviceManagementService_js_1.DeviceManagementService.blockDevice(req.user.id, req.params.deviceId);
        if (!device) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('DEVICE_BLOCKED', req.user.email, 'AUTH', 'Device', `Blocked device ${device.deviceName}`, req.user.organizationId);
        res.status(200).json({ success: true, data: device });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.blockDevice = blockDevice;
/**
 * DELETE /api/v2/auth/devices/:deviceId
 */
const removeDevice = async (req, res) => {
    try {
        const removed = await DeviceManagementService_js_1.DeviceManagementService.removeDevice(req.user.id, req.params.deviceId);
        if (!removed) {
            res.status(404).json({ success: false, message: 'Device not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Device removed' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.removeDevice = removeDevice;
// ============================================================
// IDENTITY PROVIDER ADMIN ENDPOINTS
// ============================================================
/**
 * GET /api/v2/auth/providers
 * List all configured providers for the org (admin).
 */
const listProviders = async (req, res) => {
    try {
        const providers = await ProviderRegistry_js_1.ProviderRegistry.getProviders(req.user.organizationId);
        res.status(200).json({ success: true, data: providers });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listProviders = listProviders;
/**
 * POST /api/v2/auth/providers
 * Register a new identity provider for the org.
 */
const registerProvider = async (req, res) => {
    try {
        const providerData = { ...req.body };
        if (providerData.providerType && !providerData.provider) {
            providerData.provider = providerData.providerType;
        }
        if (providerData.provider === 'SAML2') {
            providerData.provider = 'SAML';
        }
        const provider = await ProviderRegistry_js_1.ProviderRegistry.registerProvider(req.user.organizationId, providerData);
        await (0, auditLog_service_js_1.createAuditLog)('IDP_REGISTERED', req.user.email, 'AUTH', 'Identity Provider', `Registered ${provider.provider} provider`, req.user.organizationId);
        res.status(201).json({ success: true, data: provider });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.registerProvider = registerProvider;
/**
 * DELETE /api/v2/auth/providers/:providerType
 * Remove an identity provider.
 */
const removeProvider = async (req, res) => {
    try {
        const providerKey = req.params.providerType.toUpperCase() === 'SAML2' ? 'SAML' : req.params.providerType.toUpperCase();
        const removed = await ProviderRegistry_js_1.ProviderRegistry.removeProvider(req.user.organizationId, providerKey);
        if (!removed) {
            res.status(404).json({ success: false, message: 'Provider not found' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('IDP_REMOVED', req.user.email, 'AUTH', 'Identity Provider', `Removed ${req.params.providerType} provider`, req.user.organizationId);
        res.status(200).json({ success: true, message: 'Provider removed' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.removeProvider = removeProvider;
// ============================================================
// SESSION POLICY ADMIN ENDPOINTS
// ============================================================
/**
 * GET /api/v2/auth/session-policies
 */
const listSessionPolicies = async (req, res) => {
    try {
        const policies = await SessionPolicyService_js_1.SessionPolicyService.listPolicies(req.user.organizationId);
        res.status(200).json({ success: true, data: policies });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.listSessionPolicies = listSessionPolicies;
/**
 * POST /api/v2/auth/session-policies
 */
const createSessionPolicy = async (req, res) => {
    try {
        const policy = await SessionPolicyService_js_1.SessionPolicyService.createPolicy(req.user.organizationId, req.body);
        res.status(201).json({ success: true, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createSessionPolicy = createSessionPolicy;
/**
 * PUT /api/v2/auth/session-policies/:policyId
 */
const updateSessionPolicy = async (req, res) => {
    try {
        const policy = await SessionPolicyService_js_1.SessionPolicyService.updatePolicy(req.params.policyId, req.user.organizationId, req.body);
        if (!policy) {
            res.status(404).json({ success: false, message: 'Policy not found' });
            return;
        }
        res.status(200).json({ success: true, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateSessionPolicy = updateSessionPolicy;
/**
 * DELETE /api/v2/auth/session-policies/:policyId
 */
const deleteSessionPolicy = async (req, res) => {
    try {
        await SessionPolicyService_js_1.SessionPolicyService.deletePolicy(req.params.policyId, req.user.organizationId);
        res.status(200).json({ success: true, message: 'Policy deleted' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteSessionPolicy = deleteSessionPolicy;
// ============================================================
// LOGIN RISK / AUDIT ENDPOINTS
// ============================================================
/**
 * GET /api/v2/auth/login-events
 */
const getLoginEvents = async (req, res) => {
    try {
        const { limit, riskLevel, status } = req.query;
        const events = await LoginRiskService_js_1.LoginRiskService.getOrgLoginEvents(req.user.organizationId, {
            limit: limit ? parseInt(limit) : 50,
            riskLevel: riskLevel,
            status: status,
        });
        res.status(200).json({ success: true, data: events });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getLoginEvents = getLoginEvents;
/**
 * GET /api/v2/auth/login-history
 */
const getMyLoginHistory = async (req, res) => {
    try {
        const events = await LoginRiskService_js_1.LoginRiskService.getLoginHistory(req.user.email, 20, req.user.organizationId);
        res.status(200).json({ success: true, data: events });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyLoginHistory = getMyLoginHistory;
