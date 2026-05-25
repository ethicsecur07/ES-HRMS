"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_js_1 = require("./notification.controller.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Any authenticated user can view their notifications
router.get('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('NOTIFICATIONS', 'view'), notification_controller_js_1.getUserNotifications);
router.put('/read-all', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('NOTIFICATIONS', 'edit'), notification_controller_js_1.markAllAsRead);
router.put('/:id/read', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('NOTIFICATIONS', 'edit'), notification_controller_js_1.markAsRead);
exports.default = router;
