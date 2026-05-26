import { Request, Response } from 'express';
import crypto from 'crypto';
import { ProviderRegistry } from './services/ProviderRegistry.js';
import { MFAService } from './services/MFAService.js';
import { DeviceManagementService } from './services/DeviceManagementService.js';
import { LoginRiskService } from './services/LoginRiskService.js';
import { SessionPolicyService } from './services/SessionPolicyService.js';
import { OrganizationAuthConfig, ProviderType } from '../../models/OrganizationAuthConfig.js';
import { User } from '../../models/User.js';
import { Organization } from '../../models/Organization.js';
import { generateToken } from '../../utils/jwt.js';
import { createAuditLog } from '../../services/auditLog.service.js';

interface AuthRequest extends Request {
  user?: { id: string; role: string; email: string; organizationId: string };
}

// ============================================================
// SSO ENDPOINTS
// ============================================================

/**
 * GET /api/v2/auth/sso/providers/:orgSlug
 * List available SSO providers for an organization.
 */
export const getOrgProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgSlug } = req.params;
    const org = await Organization.findOne({ slug: orgSlug.toLowerCase().trim(), isActive: true });
    if (!org) {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    const providers = await ProviderRegistry.getProviders(org._id.toString());
    res.status(200).json({
      success: true,
      data: providers.map((p: any) => ({
        type: p.provider,
        name: p.displayName,
        isPrimary: p.isPrimary,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v2/auth/sso/initiate/:orgSlug/:providerType
 * Initiate SSO login — redirects user to the IDP.
 */
export const initiateSSO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgSlug, providerType } = req.params;
    const org = await Organization.findOne({ slug: orgSlug.toLowerCase().trim(), isActive: true });
    if (!org) {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    const providerKey = (providerType || '').toUpperCase() === 'SAML2' ? 'SAML' : (providerType || '').toUpperCase();
    const provider = await ProviderRegistry.getProviderByType(
      org._id.toString(),
      providerKey as ProviderType
    );
    if (!provider) {
      res.status(404).json({ success: false, message: `Provider ${providerType} not configured for this organization` });
      return;
    }

    const adapter = ProviderRegistry.createAdapter(provider);
    const state = crypto.randomUUID(); // In production: store in session/Redis

    const authUrl = adapter.getAuthorizationUrl(state);

    res.status(200).json({
      success: true,
      data: { authorizationUrl: authUrl, state },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v2/auth/sso/callback
 * Handle SSO callback from IDP.
 */
export const handleSSOCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, orgSlug, providerType, SAMLResponse } = req.body;

    const org = await Organization.findOne({ slug: orgSlug?.toLowerCase().trim(), isActive: true });
    if (!org) {
      res.status(404).json({ success: false, message: 'Organization not found' });
      return;
    }

    const providerKey = (providerType || 'SAML').toUpperCase() === 'SAML2' ? 'SAML' : (providerType || 'SAML').toUpperCase();
    const provider = await ProviderRegistry.getProviderByType(
      org._id.toString(),
      providerKey as ProviderType
    );
    if (!provider) {
      res.status(404).json({ success: false, message: 'Provider not configured' });
      return;
    }

    const adapter = ProviderRegistry.createAdapter(provider);
    const authResult = await adapter.handleCallback(SAMLResponse || code);

    if (!authResult.profile.email) {
      res.status(400).json({ success: false, message: 'No email returned from identity provider' });
      return;
    }

    // Restrict Microsoft SSO login exclusively to @ethicsecur.co.in domain
    if (providerType === 'MICROSOFT' && !authResult.profile.email.toLowerCase().endsWith('@ethicsecur.co.in')) {
      res.status(403).json({ success: false, message: 'Access denied. Only @ethicsecur.co.in corporate accounts are authorized.' });
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || '';

    // Risk assessment
    const risk = await LoginRiskService.evaluateRisk({
      email: authResult.profile.email,
      ipAddress,
      userAgent,
      organizationId: org._id.toString(),
    });

    if (risk.shouldBlock) {
      await LoginRiskService.recordEvent({
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
    const sessionPolicy = await SessionPolicyService.getPolicy(org._id.toString());
    if (sessionPolicy) {
      const ipCheck = SessionPolicyService.validateIP(sessionPolicy, ipAddress);
      if (!ipCheck.allowed) {
        res.status(403).json({ success: false, message: ipCheck.reason });
        return;
      }
    }

    // Find or auto-provision user
    let user = await User.findOne({
      email: { $regex: new RegExp(`^${authResult.profile.email}$`, 'i') },
      organizationId: org._id,
    });

    // Map role from Azure AD App Roles if available
    let resolvedRole: string | null = null;
    if (authResult.profile.roles && authResult.profile.roles.length > 0) {
      const rolesUpper = authResult.profile.roles.map((r: string) => r.toUpperCase());
      if (rolesUpper.includes('ADMIN')) resolvedRole = 'ADMIN';
      else if (rolesUpper.includes('HR')) resolvedRole = 'HR';
      else if (rolesUpper.includes('MANAGER')) resolvedRole = 'MANAGER';
      else if (rolesUpper.includes('TEAM_LEAD') || rolesUpper.includes('TEAMLEAD')) resolvedRole = 'TEAM_LEAD';
      else if (rolesUpper.includes('EMPLOYEE')) resolvedRole = 'EMPLOYEE';
    }

    if (user) {
      // Dynamic updates on login
      user.name = authResult.profile.name || user.name;
      if (resolvedRole) {
        user.role = resolvedRole as any;
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
    } else if (provider.autoProvision) {
      user = await User.create({
        organizationId: org._id,
        name: authResult.profile.name,
        email: authResult.profile.email,
        role: (resolvedRole || provider.defaultRoleCode || 'EMPLOYEE') as any,
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
      await createAuditLog(
        'USER_AUTO_PROVISIONED',
        `${user.name} via ${providerType} SSO`,
        'AUTH',
        'User Account',
        `Auto-provisioned from ${providerType} with role ${user.role}`,
        org._id
      );
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
    const { device, isNewDevice } = await DeviceManagementService.registerDevice({
      userId: user._id.toString(),
      organizationId: org._id.toString(),
      userAgent,
      ipAddress,
    });

    // Check MFA requirement
    const mfaRequired = await MFAService.isRequired(user._id.toString(), org._id.toString());
    if (mfaRequired) {
      // Return a partial token that requires MFA verification
      const mfaToken = generateToken({
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        organizationId: org._id.toString(),
        employeeId: user.employeeId?.toString(),
        mfaPending: true,
      });

      await LoginRiskService.recordEvent({
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
        mfaMethods: (await MFAService.getStatus(user._id.toString(), org._id.toString()))?.methods,
      });
      return;
    }

    // Issue full session token
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      organizationId: org._id.toString(),
      employeeId: user.employeeId?.toString(),
    });

    await LoginRiskService.recordEvent({
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

    await createAuditLog(
      'SSO_LOGIN',
      `${user.name} via ${providerType}`,
      'AUTH',
      'User Session',
      `SSO login from IP ${ipAddress} (Risk: ${risk.riskLevel})`,
      org._id
    );

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// MFA ENDPOINTS
// ============================================================

/**
 * POST /api/v2/auth/mfa/setup
 */
export const setupMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { method } = req.body;
    const result = await MFAService.setupMFA(
      req.user!.id,
      req.user!.organizationId,
      method || 'TOTP'
    );
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v2/auth/mfa/verify
 */
export const verifyMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code, method } = req.body;
    const isValid = await MFAService.verify(
      req.user!.id,
      req.user!.organizationId,
      code,
      method
    );

    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid MFA code' });
      return;
    }

    // Issue full token (if this was an MFA challenge)
    const token = generateToken({
      id: req.user!.id,
      role: req.user!.role,
      email: req.user!.email,
      organizationId: req.user!.organizationId,
      employeeId: (req.user as any).employeeId,
    });

    res.status(200).json({ success: true, data: { verified: true, token } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v2/auth/mfa/recovery
 */
export const verifyRecoveryCode = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const isValid = await MFAService.verifyRecoveryCode(
      req.user!.id,
      req.user!.organizationId,
      code
    );

    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid recovery code' });
      return;
    }

    const token = generateToken({
      id: req.user!.id,
      role: req.user!.role,
      email: req.user!.email,
      organizationId: req.user!.organizationId,
      employeeId: (req.user as any).employeeId,
    });

    res.status(200).json({ success: true, data: { verified: true, token } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v2/auth/mfa/status
 */
export const getMFAStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await MFAService.getStatus(req.user!.id, req.user!.organizationId);
    res.status(200).json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v2/auth/mfa/disable
 */
export const disableMFA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await MFAService.disableMFA(req.user!.id, req.user!.organizationId);
    await createAuditLog('MFA_DISABLED', req.user!.email, 'AUTH', 'MFA', 'MFA disabled by user', req.user!.organizationId);
    res.status(200).json({ success: true, message: 'MFA disabled' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// DEVICE MANAGEMENT ENDPOINTS
// ============================================================

/**
 * GET /api/v2/auth/devices
 */
export const getDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const devices = await DeviceManagementService.getUserDevices(req.user!.id);
    res.status(200).json({ success: true, data: devices });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/v2/auth/devices/:deviceId/trust
 */
export const trustDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await DeviceManagementService.trustDevice(req.user!.id, req.params.deviceId);
    if (!device) {
      res.status(404).json({ success: false, message: 'Device not found' });
      return;
    }
    res.status(200).json({ success: true, data: device });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/v2/auth/devices/:deviceId/block
 */
export const blockDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const device = await DeviceManagementService.blockDevice(req.user!.id, req.params.deviceId);
    if (!device) {
      res.status(404).json({ success: false, message: 'Device not found' });
      return;
    }
    await createAuditLog('DEVICE_BLOCKED', req.user!.email, 'AUTH', 'Device', `Blocked device ${device.deviceName}`, req.user!.organizationId);
    res.status(200).json({ success: true, data: device });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v2/auth/devices/:deviceId
 */
export const removeDevice = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const removed = await DeviceManagementService.removeDevice(req.user!.id, req.params.deviceId);
    if (!removed) {
      res.status(404).json({ success: false, message: 'Device not found' });
      return;
    }
    res.status(200).json({ success: true, message: 'Device removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// IDENTITY PROVIDER ADMIN ENDPOINTS
// ============================================================

/**
 * GET /api/v2/auth/providers
 * List all configured providers for the org (admin).
 */
export const listProviders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providers = await ProviderRegistry.getProviders(req.user!.organizationId);
    res.status(200).json({ success: true, data: providers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v2/auth/providers
 * Register a new identity provider for the org.
 */
export const registerProvider = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providerData = { ...req.body };
    if (providerData.providerType && !providerData.provider) {
      providerData.provider = providerData.providerType;
    }
    if (providerData.provider === 'SAML2') {
      providerData.provider = 'SAML';
    }
    const provider = await ProviderRegistry.registerProvider(req.user!.organizationId, providerData);
    await createAuditLog(
      'IDP_REGISTERED',
      req.user!.email,
      'AUTH',
      'Identity Provider',
      `Registered ${provider.provider} provider`,
      req.user!.organizationId
    );
    res.status(201).json({ success: true, data: provider });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v2/auth/providers/:providerType
 * Remove an identity provider.
 */
export const removeProvider = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const providerKey = req.params.providerType.toUpperCase() === 'SAML2' ? 'SAML' : req.params.providerType.toUpperCase();
    const removed = await ProviderRegistry.removeProvider(
      req.user!.organizationId,
      providerKey as ProviderType
    );
    if (!removed) {
      res.status(404).json({ success: false, message: 'Provider not found' });
      return;
    }
    await createAuditLog(
      'IDP_REMOVED',
      req.user!.email,
      'AUTH',
      'Identity Provider',
      `Removed ${req.params.providerType} provider`,
      req.user!.organizationId
    );
    res.status(200).json({ success: true, message: 'Provider removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// SESSION POLICY ADMIN ENDPOINTS
// ============================================================

/**
 * GET /api/v2/auth/session-policies
 */
export const listSessionPolicies = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policies = await SessionPolicyService.listPolicies(req.user!.organizationId);
    res.status(200).json({ success: true, data: policies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v2/auth/session-policies
 */
export const createSessionPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await SessionPolicyService.createPolicy(req.user!.organizationId, req.body);
    res.status(201).json({ success: true, data: policy });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/v2/auth/session-policies/:policyId
 */
export const updateSessionPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const policy = await SessionPolicyService.updatePolicy(
      req.params.policyId,
      req.user!.organizationId,
      req.body
    );
    if (!policy) {
      res.status(404).json({ success: false, message: 'Policy not found' });
      return;
    }
    res.status(200).json({ success: true, data: policy });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v2/auth/session-policies/:policyId
 */
export const deleteSessionPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await SessionPolicyService.deletePolicy(req.params.policyId, req.user!.organizationId);
    res.status(200).json({ success: true, message: 'Policy deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================
// LOGIN RISK / AUDIT ENDPOINTS
// ============================================================

/**
 * GET /api/v2/auth/login-events
 */
export const getLoginEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit, riskLevel, status } = req.query;
    const events = await LoginRiskService.getOrgLoginEvents(req.user!.organizationId, {
      limit: limit ? parseInt(limit as string) : 50,
      riskLevel: riskLevel as any,
      status: status as string,
    });
    res.status(200).json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v2/auth/login-history
 */
export const getMyLoginHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const events = await LoginRiskService.getLoginHistory(
      req.user!.email,
      20,
      req.user!.organizationId
    );
    res.status(200).json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
