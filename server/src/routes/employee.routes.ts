import { Router } from 'express';
import { getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee } from '../controllers/employee.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate as any, getEmployees as any);
router.get('/:id', authenticate as any, getEmployeeById as any);
router.post('/', authenticate as any, authorize(['ADMIN', 'HR']) as any, createEmployee as any);
router.put('/:id', authenticate as any, authorize(['ADMIN', 'HR']) as any, updateEmployee as any);
router.delete('/:id', authenticate as any, authorize(['ADMIN']) as any, deleteEmployee as any);

export default router;
