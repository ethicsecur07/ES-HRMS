import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createDepartmentSchema, updateDepartmentSchema } from '../validations/department.validation.js';

const router = Router();

router.use(authenticate as any);

router.get('/', rbacGuard('EMPLOYEES', 'view') as any, getDepartments as any);
router.get('/:id', rbacGuard('EMPLOYEES', 'view') as any, getDepartmentById as any);
router.post(
  '/',
  rbacGuard('EMPLOYEES', 'create') as any,
  validateRequest(createDepartmentSchema) as any,
  createDepartment as any
);
router.put(
  '/:id',
  rbacGuard('EMPLOYEES', 'edit') as any,
  validateRequest(updateDepartmentSchema) as any,
  updateDepartment as any
);
router.delete('/:id', rbacGuard('EMPLOYEES', 'delete') as any, deleteDepartment as any);

export default router;
