import { Router } from 'express';
import { applyWFH, getWFHRequests, updateWFHStatus } from '../controllers/wfh.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/apply', authenticate as any, applyWFH as any);
router.get('/', authenticate as any, getWFHRequests as any);
router.put('/:id/status', authenticate as any, authorize(['ADMIN', 'HR']) as any, updateWFHStatus as any);

export default router;
