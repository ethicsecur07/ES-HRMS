import { Router } from 'express';
import { getDashboardStats, getAuditLogs, getSettings, updateSettings } from '../controllers/analytics.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';

const router = Router();

router.get('/dashboard-stats', authenticate as any, getDashboardStats as any);
router.get('/audit-logs', authenticate as any, authorize(['ADMIN']) as any, getAuditLogs as any);
router.get('/settings', authenticate as any, getSettings as any);
router.put('/settings', authenticate as any, rbacGuard('SETTINGS', 'edit') as any, updateSettings as any);

export default router;
