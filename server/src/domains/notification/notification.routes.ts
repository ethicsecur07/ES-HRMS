import { Router } from 'express';
import { getUserNotifications, markAsRead, markAllAsRead } from './notification.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Any authenticated user can view their notifications
router.get('/', authenticate as any, rbacGuard('NOTIFICATIONS', 'view') as any, getUserNotifications);
router.put('/read-all', authenticate as any, rbacGuard('NOTIFICATIONS', 'edit') as any, markAllAsRead);
router.put('/:id/read', authenticate as any, rbacGuard('NOTIFICATIONS', 'edit') as any, markAsRead);

export default router;
