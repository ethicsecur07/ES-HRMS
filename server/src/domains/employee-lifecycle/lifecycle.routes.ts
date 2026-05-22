import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { moduleGuard } from '../../middlewares/moduleGuard.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import {
  getLifecycleTrackers,
  createLifecycleTracker,
  updateLifecycleStep,
  updateLifecycleDetails,
} from './lifecycle.controller.js';

const router = Router();

router.use(authenticate);
router.use(moduleGuard(['EMPLOYEE_LIFECYCLE']));

// Retrieve all workflows
router.get('/', rbacGuard('EMPLOYEE_LIFECYCLE', 'view'), getLifecycleTrackers);

// Trigger a new lifecycle (Onboarding induction, Resignation notice, etc.)
router.post('/', rbacGuard('EMPLOYEE_LIFECYCLE', 'create'), createLifecycleTracker);

// Update details on a specific workflow (Probation confirming updates, promotion levels, etc.)
router.put('/:id', rbacGuard('EMPLOYEE_LIFECYCLE', 'edit'), updateLifecycleDetails);

// Complete or skip checklist items
router.put('/:trackerId/step/:stepId', rbacGuard('EMPLOYEE_LIFECYCLE', 'edit'), updateLifecycleStep);

export default router;
