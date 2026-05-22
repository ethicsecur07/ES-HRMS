import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  getAllPolicies,
  createPolicy,
  updatePolicy,
  togglePolicyStatus,
} from '../controllers/leavePolicy.controller.js';

const router = Router();

router.use(authenticate as any);

// All authenticated users can view policies
router.get('/', getAllPolicies as any);

// Admin only for creating, updating, toggling
router.post('/', authorize(['ADMIN']) as any, createPolicy as any);
router.put('/:id', authorize(['ADMIN']) as any, updatePolicy as any);
router.patch('/:id/toggle', authorize(['ADMIN']) as any, togglePolicyStatus as any);

export default router;
