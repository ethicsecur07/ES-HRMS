import { Router } from 'express';
import {
  getConversation,
  sendMessage,
  sendFileMessage,
  markMessageRead,
  chatUpload
} from './chat.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';

const router = Router();

router.get('/:otherUserId', authenticate as any, rbacGuard('CHAT', 'view') as any, getConversation as any);
router.post('/', authenticate as any, rbacGuard('CHAT', 'create') as any, sendMessage as any);
router.post('/upload', authenticate as any, rbacGuard('CHAT', 'create') as any, chatUpload.single('file') as any, sendFileMessage as any);
router.patch('/:messageId/read', authenticate as any, markMessageRead as any);

export default router;
