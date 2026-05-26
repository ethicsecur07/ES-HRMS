import { Router } from 'express';
import { 
  getEmployees, 
  getNextEmployeeCode, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee,
  syncMicrosoftEmployees
} from '../controllers/employee.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
import { validateRequest } from '../middlewares/validate.middleware.js';
import { createEmployeeSchema, updateEmployeeSchema } from '../validations/employee.validation.js';

const router = Router();

router.get('/', authenticate as any, rbacGuard('EMPLOYEES', 'view') as any, getEmployees as any);
router.get('/next-code', authenticate as any, rbacGuard('EMPLOYEES', 'view') as any, getNextEmployeeCode as any);
router.post('/sync-microsoft', authenticate as any, rbacGuard('EMPLOYEES', 'create') as any, syncMicrosoftEmployees as any);
router.get('/:id', authenticate as any, rbacGuard('EMPLOYEES', 'view') as any, getEmployeeById as any);
router.post('/', authenticate as any, rbacGuard('EMPLOYEES', 'create') as any, validateRequest(createEmployeeSchema) as any, createEmployee as any);
router.put('/:id', authenticate as any, rbacGuard('EMPLOYEES', 'edit') as any, validateRequest(updateEmployeeSchema) as any, updateEmployee as any);
router.delete('/:id', authenticate as any, rbacGuard('EMPLOYEES', 'delete') as any, deleteEmployee as any);

export default router;
