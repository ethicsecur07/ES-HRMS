import { Router } from 'express';
import { getPayrolls, generatePayroll, updatePayrollStatus } from '../controllers/payroll.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate as any, getPayrolls as any);
router.post('/generate', authenticate as any, authorize(['ADMIN', 'HR']) as any, generatePayroll as any);
router.put('/:id/status', authenticate as any, authorize(['ADMIN', 'HR']) as any, updatePayrollStatus as any);

export default router;
