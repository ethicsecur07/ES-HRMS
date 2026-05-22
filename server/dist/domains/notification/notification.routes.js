"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_js_1 = require("./notification.controller.js");
const router = (0, express_1.Router)();
// Any authenticated user can view their notifications
router.get('/', notification_controller_js_1.getUserNotifications);
router.put('/read-all', notification_controller_js_1.markAllAsRead);
router.put('/:id/read', notification_controller_js_1.markAsRead);
exports.default = router;
