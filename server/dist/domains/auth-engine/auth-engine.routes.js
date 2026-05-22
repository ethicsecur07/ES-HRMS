"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const auth_engine_controller_js_1 = require("./auth-engine.controller.js");
const router = (0, express_1.Router)();
// ── SSO Routes (public) ──────────────────────────────────────
router.get('/sso/providers/:orgSlug', auth_engine_controller_js_1.getOrgProviders);
router.get('/sso/initiate/:orgSlug/:providerType', auth_engine_controller_js_1.initiateSSO);
router.post('/sso/callback', auth_engine_controller_js_1.handleSSOCallback);
// ── MFA Routes (authenticated) ───────────────────────────────
router.post('/mfa/setup', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.setupMFA);
router.post('/mfa/verify', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.verifyMFA);
router.post('/mfa/recovery', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.verifyRecoveryCode);
router.get('/mfa/status', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.getMFAStatus);
router.delete('/mfa/disable', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.disableMFA);
// ── Device Management Routes (authenticated) ─────────────────
router.get('/devices', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.getDevices);
router.put('/devices/:deviceId/trust', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.trustDevice);
router.put('/devices/:deviceId/block', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.blockDevice);
router.delete('/devices/:deviceId', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.removeDevice);
// ── Identity Provider Admin Routes (admin only) ──────────────
router.get('/providers', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.listProviders);
router.post('/providers', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.registerProvider);
router.delete('/providers/:providerType', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.removeProvider);
// ── Session Policy Admin Routes (admin only) ─────────────────
router.get('/session-policies', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.listSessionPolicies);
router.post('/session-policies', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.createSessionPolicy);
router.put('/session-policies/:policyId', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.updateSessionPolicy);
router.delete('/session-policies/:policyId', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN']), auth_engine_controller_js_1.deleteSessionPolicy);
// ── Login Events / Audit (admin + user) ──────────────────────
router.get('/login-events', auth_middleware_js_1.authenticate, (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), auth_engine_controller_js_1.getLoginEvents);
router.get('/login-history', auth_middleware_js_1.authenticate, auth_engine_controller_js_1.getMyLoginHistory);
exports.default = router;
