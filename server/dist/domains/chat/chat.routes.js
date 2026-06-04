"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_js_1 = require("./chat.controller.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const router = (0, express_1.Router)();
router.get('/conversations/recent', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('CHAT', 'view'), chat_controller_js_1.getRecentConversations);
// GET /online-users MUST come before /:otherUserId so the wildcard doesn't capture it
router.get('/online-users', auth_middleware_js_1.authenticate, chat_controller_js_1.getOnlineUsers);
router.post('/admin/backup-sync', auth_middleware_js_1.authenticate, chat_controller_js_1.triggerChatBackup);
router.get('/:otherUserId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('CHAT', 'view'), chat_controller_js_1.getConversation);
router.post('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('CHAT', 'create'), chat_controller_js_1.sendMessage);
router.post('/upload', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('CHAT', 'create'), chat_controller_js_1.chatUpload.single('file'), chat_controller_js_1.sendFileMessage);
router.patch('/:messageId/read', auth_middleware_js_1.authenticate, chat_controller_js_1.markMessageRead);
router.post('/offline-hard', auth_middleware_js_1.authenticate, chat_controller_js_1.markOfflineHard);
exports.default = router;
