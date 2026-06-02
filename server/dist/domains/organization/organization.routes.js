"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const core_org_controller_js_1 = require("./core-org.controller.js");
const router = (0, express_1.Router)();
// PUBLIC ROUTES (SaaS Tenant Registration)
router.post('/register', core_org_controller_js_1.registerOrganization);
// AUTHENTICATED ROUTES
router.use(auth_middleware_js_1.authenticate);
// TENANT ADMIN ROUTES
// Note: Only ADMIN role can modify org settings. The controller verifies this via role/permissions or the guard.
router.put('/settings', core_org_controller_js_1.updateOrganizationSettings);
exports.default = router;
