import { Router } from 'express';
import {
  login,
  signup,
  logout,
  refreshToken,
  getMe,
  updateMe,
  getTenantConfig,
  verifyMfa,
  setupMfa,
  enableMfa,
  disableMfa,
  getUserSessions,
  revokeSession,
  impersonate
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/tenant-config', getTenantConfig as any);
router.get('/tenant-config/:slug', getTenantConfig as any);
router.post('/login', login as any);
router.post('/signup', signup as any);
router.post('/refresh', refreshToken as any);
router.post('/logout', authenticate as any, logout as any);
router.get('/me', authenticate as any, getMe as any);
router.put('/me', authenticate as any, updateMe as any);

// MFA Routes
router.post('/mfa/verify', verifyMfa as any);
router.post('/mfa/setup', authenticate as any, setupMfa as any);
router.post('/mfa/enable', authenticate as any, enableMfa as any);
router.post('/mfa/disable', authenticate as any, disableMfa as any);

// Session Routes
router.get('/sessions', authenticate as any, getUserSessions as any);
router.post('/sessions/revoke', authenticate as any, revokeSession as any);

// Impersonation Routes
router.post('/impersonate', authenticate as any, impersonate as any);

export default router;
