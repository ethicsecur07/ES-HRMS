import { Router } from 'express';
import { applyLeave, getLeaves, updateLeaveStatus } from '../controllers/leave.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/apply', authenticate as any, applyLeave as any);
router.get('/', authenticate as any, getLeaves as any);
router.put('/:id/status', authenticate as any, authorize(['ADMIN', 'HR']) as any, updateLeaveStatus as any);

export default router;
