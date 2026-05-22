import { Router } from 'express';
import {
  getAttendanceReport,
  getPayrollReport,
  getPerformanceReport,
  getExpenseReport,
  getLeaveReport,
  getProjectReport
} from '../controllers/reports.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Only ADMIN, HR, MANAGER can access these reports
router.use(authenticate as any);
router.use(authorize(['ADMIN', 'HR', 'MANAGER']) as any);

router.get('/attendance', getAttendanceReport);
router.get('/payroll', getPayrollReport);
router.get('/performance', getPerformanceReport);
router.get('/expenses', getExpenseReport);
router.get('/leave', getLeaveReport);
router.get('/projects', getProjectReport);

export default router;
