"use strict";
/**
 * leavev2.routes.ts
 * ------------------
 * Enterprise leave V2 routes with RBAC guard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const auth_middleware_js_2 = require("../../middlewares/auth.middleware.js");
const leavev2_controller_js_1 = require("./leavev2.controller.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// Summary and analytics (ADMIN/HR)
router.get('/summary', (0, auth_middleware_js_2.authorize)(['ADMIN', 'HR']), leavev2_controller_js_1.getLeaveV2Summary);
router.get('/analytics', (0, auth_middleware_js_2.authorize)(['ADMIN', 'HR']), leavev2_controller_js_1.getLeaveAnalytics);
// Accrual trigger (ADMIN only)
router.post('/accrue', (0, auth_middleware_js_2.authorize)(['ADMIN']), leavev2_controller_js_1.runAutomatedAccruals);
// Sandwich rule check (any authenticated user)
router.post('/sandwich-check', leavev2_controller_js_1.checkSandwichRule);
// Encashment request (any authenticated employee)
router.post('/encash', leavev2_controller_js_1.submitEncashment);
// ── Leave Balance Self-Service ────────────────────────────────────────────
// Employee: view own balances (enriched with policy meta)
router.get('/balance/me', leavev2_controller_js_1.getMyLeaveBalances);
// Admin/HR: view balances for a specific employee
router.get('/balance/:empId', (0, auth_middleware_js_2.authorize)(['ADMIN', 'HR']), leavev2_controller_js_1.getEmployeeLeaveBalances);
exports.default = router;
