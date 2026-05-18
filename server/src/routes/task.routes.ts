import { Router } from 'express';
import { submitTaskReport, getTaskReports, getEmployeeTasks } from '../controllers/task.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/submit', authenticate as any, submitTaskReport as any);
router.get('/', authenticate as any, getTaskReports as any);
router.get('/employee/:employeeId', authenticate as any, getEmployeeTasks as any);

export default router;
