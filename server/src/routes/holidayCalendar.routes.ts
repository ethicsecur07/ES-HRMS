import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from '../controllers/holidayCalendar.controller.js';

const router = Router();

router.use(authenticate as any);

// All authenticated users can view holidays
router.get('/', getHolidays as any);

// Admin and HR can manage holidays
router.post('/', authorize(['ADMIN', 'HR']) as any, createHoliday as any);
router.put('/:id', authorize(['ADMIN', 'HR']) as any, updateHoliday as any);
router.delete('/:id', authorize(['ADMIN', 'HR']) as any, deleteHoliday as any);

export default router;
