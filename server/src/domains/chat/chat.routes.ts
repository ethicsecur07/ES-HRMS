import { Router } from 'express';
import { getConversation, sendMessage } from './chat.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';

const router = Router();

router.get('/:otherUserId', authenticate as any, rbacGuard('CHAT', 'view') as any, getConversation);
router.post('/', authenticate as any, rbacGuard('CHAT', 'create') as any, sendMessage);

export default router;
