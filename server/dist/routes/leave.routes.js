"use strict";
/**
 * leave.routes.ts (REFACTORED)
 * ------------------------------
 * Adds:
 *   - POST /:id/cancel — leave cancellation with balance restoration
 *   - GET / — with query filter support (status, leaveType)
 *   - Proper authorization: EMPLOYEE can only cancel own leaves
 *   - ADMIN/HR required for status updates
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leave_controller_js_1 = require("../controllers/leave.controller.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_js_1.authenticate);
// Apply for leave (any authenticated user)
router.post('/apply', leave_controller_js_1.applyLeave);
// Get leaves (scoped by role in controller)
router.get('/', leave_controller_js_1.getLeaves);
// Update leave status (ADMIN/HR only)
router.put('/:id/status', (0, auth_middleware_js_1.authorize)(['ADMIN', 'HR']), leave_controller_js_1.updateLeaveStatus);
// Cancel a leave (own leave for EMPLOYEE; any for ADMIN/HR)
router.post('/:id/cancel', leave_controller_js_1.cancelLeave);
exports.default = router;
