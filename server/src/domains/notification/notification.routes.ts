import { Router } from 'express';
import { getUserNotifications, markAsRead, markAllAsRead } from './notification.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';

const router = Router();

// Any authenticated user can view their notifications
router.get('/', getUserNotifications);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

export default router;
