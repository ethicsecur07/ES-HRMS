import { Router } from 'express';
import {
  getConversation,
  sendMessage,
  sendFileMessage,
  markMessageRead,
  getRecentConversations,
  chatUpload,
  markOfflineHard,
  getOnlineUsers,
  triggerChatBackup,
} from './chat.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';

const router = Router();

router.get('/conversations/recent', authenticate as any, rbacGuard('CHAT', 'view') as any, getRecentConversations as any);
// GET /online-users MUST come before /:otherUserId so the wildcard doesn't capture it
router.get('/online-users', authenticate as any, getOnlineUsers as any);
router.post('/admin/backup-sync', authenticate as any, triggerChatBackup as any);
router.get('/:otherUserId', authenticate as any, rbacGuard('CHAT', 'view') as any, getConversation as any);
router.post('/', authenticate as any, rbacGuard('CHAT', 'create') as any, sendMessage as any);
router.post('/upload', authenticate as any, rbacGuard('CHAT', 'create') as any, chatUpload.single('file') as any, sendFileMessage as any);
router.patch('/:messageId/read', authenticate as any, markMessageRead as any);
router.post('/offline-hard', authenticate as any, markOfflineHard as any);

export default router;
