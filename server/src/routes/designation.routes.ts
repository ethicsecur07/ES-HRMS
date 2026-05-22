import { Router } from 'express';
import {
  getDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} from '../controllers/designation.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createDesignationSchema, updateDesignationSchema } from '../validations/designation.validation.js';

const router = Router();

router.use(authenticate as any);

router.get('/', rbacGuard('EMPLOYEES', 'view') as any, getDesignations as any);
router.get('/:id', rbacGuard('EMPLOYEES', 'view') as any, getDesignationById as any);
router.post(
  '/',
  rbacGuard('EMPLOYEES', 'create') as any,
  validateRequest(createDesignationSchema) as any,
  createDesignation as any
);
router.put(
  '/:id',
  rbacGuard('EMPLOYEES', 'edit') as any,
  validateRequest(updateDesignationSchema) as any,
  updateDesignation as any
);
router.delete('/:id', rbacGuard('EMPLOYEES', 'delete') as any, deleteDesignation as any);

export default router;
