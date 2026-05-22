import { Router } from 'express';
import { triggerPayrollRun, getPayrollRuns, rollbackPayrollRun, exportFinanceJournal, approvePayrollRun, getPayslipPDF } from './payroll.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';

const router = Router();

router.use(authenticate as any);

router.get('/runs', rbacGuard('PAYROLL', 'view'), getPayrollRuns);
router.post('/runs/trigger', rbacGuard('PAYROLL', 'create'), triggerPayrollRun);
router.post('/runs/:runCycle/rollback', rbacGuard('PAYROLL', 'create'), rollbackPayrollRun);
router.post('/runs/export', rbacGuard('PAYROLL', 'create'), exportFinanceJournal);
router.post('/runs/approve', rbacGuard('PAYROLL', 'create'), approvePayrollRun);
router.get('/payslips/:payrollId/pdf', rbacGuard('PAYROLL', 'view'), getPayslipPDF);

export default router;
