import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
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

// RBAC authorized endpoints for managing policies
router.post('/', rbacGuard('LEAVE_POLICY', 'create') as any, createPolicy as any);
router.put('/:id', rbacGuard('LEAVE_POLICY', 'edit') as any, updatePolicy as any);
router.patch('/:id/toggle', rbacGuard('LEAVE_POLICY', 'edit') as any, togglePolicyStatus as any);

export default router;
