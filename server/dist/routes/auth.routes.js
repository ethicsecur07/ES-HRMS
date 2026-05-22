"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
router.get('/tenant-config', auth_controller_js_1.getTenantConfig);
router.get('/tenant-config/:slug', auth_controller_js_1.getTenantConfig);
router.post('/login', auth_controller_js_1.login);
router.post('/refresh', auth_controller_js_1.refreshToken);
router.post('/logout', auth_middleware_js_1.authenticate, auth_controller_js_1.logout);
router.get('/me', auth_middleware_js_1.authenticate, auth_controller_js_1.getMe);
router.put('/me', auth_middleware_js_1.authenticate, auth_controller_js_1.updateMe);
// MFA Routes
router.post('/mfa/verify', auth_controller_js_1.verifyMfa);
router.post('/mfa/setup', auth_middleware_js_1.authenticate, auth_controller_js_1.setupMfa);
router.post('/mfa/enable', auth_middleware_js_1.authenticate, auth_controller_js_1.enableMfa);
router.post('/mfa/disable', auth_middleware_js_1.authenticate, auth_controller_js_1.disableMfa);
// Session Routes
router.get('/sessions', auth_middleware_js_1.authenticate, auth_controller_js_1.getUserSessions);
router.post('/sessions/revoke', auth_middleware_js_1.authenticate, auth_controller_js_1.revokeSession);
// Impersonation Routes
router.post('/impersonate', auth_middleware_js_1.authenticate, auth_controller_js_1.impersonate);
exports.default = router;
