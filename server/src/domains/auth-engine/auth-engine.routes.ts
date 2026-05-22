import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';
import {
  // SSO
  getOrgProviders,
  initiateSSO,
  handleSSOCallback,
  // MFA
  setupMFA,
  verifyMFA,
  verifyRecoveryCode,
  getMFAStatus,
  disableMFA,
  // Devices
  getDevices,
  trustDevice,
  blockDevice,
  removeDevice,
  // Provider Admin
  listProviders,
  registerProvider,
  removeProvider,
  // Session Policies
  listSessionPolicies,
  createSessionPolicy,
  updateSessionPolicy,
  deleteSessionPolicy,
  // Login Events
  getLoginEvents,
  getMyLoginHistory,
} from './auth-engine.controller.js';

const router = Router();

// ── SSO Routes (public) ──────────────────────────────────────
router.get('/sso/providers/:orgSlug', getOrgProviders as any);
router.get('/sso/initiate/:orgSlug/:providerType', initiateSSO as any);
router.post('/sso/callback', handleSSOCallback as any);

// ── MFA Routes (authenticated) ───────────────────────────────
router.post('/mfa/setup', authenticate as any, setupMFA as any);
router.post('/mfa/verify', authenticate as any, verifyMFA as any);
router.post('/mfa/recovery', authenticate as any, verifyRecoveryCode as any);
router.get('/mfa/status', authenticate as any, getMFAStatus as any);
router.delete('/mfa/disable', authenticate as any, disableMFA as any);

// ── Device Management Routes (authenticated) ─────────────────
router.get('/devices', authenticate as any, getDevices as any);
router.put('/devices/:deviceId/trust', authenticate as any, trustDevice as any);
router.put('/devices/:deviceId/block', authenticate as any, blockDevice as any);
router.delete('/devices/:deviceId', authenticate as any, removeDevice as any);

// ── Identity Provider Admin Routes (admin only) ──────────────
router.get('/providers', authenticate as any, authorize(['ADMIN']) as any, listProviders as any);
router.post('/providers', authenticate as any, authorize(['ADMIN']) as any, registerProvider as any);
router.delete('/providers/:providerType', authenticate as any, authorize(['ADMIN']) as any, removeProvider as any);

// ── Session Policy Admin Routes (admin only) ─────────────────
router.get('/session-policies', authenticate as any, authorize(['ADMIN']) as any, listSessionPolicies as any);
router.post('/session-policies', authenticate as any, authorize(['ADMIN']) as any, createSessionPolicy as any);
router.put('/session-policies/:policyId', authenticate as any, authorize(['ADMIN']) as any, updateSessionPolicy as any);
router.delete('/session-policies/:policyId', authenticate as any, authorize(['ADMIN']) as any, deleteSessionPolicy as any);

// ── Login Events / Audit (admin + user) ──────────────────────
router.get('/login-events', authenticate as any, authorize(['ADMIN', 'HR']) as any, getLoginEvents as any);
router.get('/login-history', authenticate as any, getMyLoginHistory as any);

export default router;
