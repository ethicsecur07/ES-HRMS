import { Router } from 'express';
import { getTodayAttendance, getAllAttendance, checkIn, checkOut, verifyIP, updateAttendance } from '../controllers/attendance.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { verifyOfficeIP } from '../middlewares/ipRestriction.js';

const router = Router();

router.get('/today', authenticate as any, getTodayAttendance as any);
router.get('/', authenticate as any, getAllAttendance as any);
router.post('/checkin', authenticate as any, verifyOfficeIP as any, checkIn as any);
router.post('/checkout/:id', authenticate as any, checkOut as any);
router.put('/:id', authenticate as any, authorize(['ADMIN', 'HR']) as any, updateAttendance as any);
router.get('/verify-ip', verifyIP as any);

export default router;
