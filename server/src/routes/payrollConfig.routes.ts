import { Router } from 'express';
import { getPayrollConfig, savePayrollConfig } from '../controllers/payrollConfig.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// GET - fetch payroll config (ADMIN/HR)
router.get('/', authenticate as any, authorize(['ADMIN', 'HR']) as any, getPayrollConfig as any);

// PUT - save/update payroll config (ADMIN/HR)
router.put('/', authenticate as any, authorize(['ADMIN', 'HR']) as any, savePayrollConfig as any);

export default router;
