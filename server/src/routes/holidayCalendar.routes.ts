import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rbacGuard } from '../middlewares/rbacGuard.js';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getGoogleHolidays,
} from '../controllers/holidayCalendar.controller.js';

const router = Router();

router.use(authenticate as any);

// All authenticated users can view holidays
router.get('/', getHolidays as any);

// RBAC authorized endpoints for managing holidays
router.get('/google', rbacGuard('LEAVE_POLICY', 'create') as any, getGoogleHolidays as any);
router.post('/', rbacGuard('LEAVE_POLICY', 'create') as any, createHoliday as any);
router.put('/:id', rbacGuard('LEAVE_POLICY', 'edit') as any, updateHoliday as any);
router.delete('/:id', rbacGuard('LEAVE_POLICY', 'delete') as any, deleteHoliday as any);

export default router;

