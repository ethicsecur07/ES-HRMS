import { Router } from 'express';
import {
  scheduleMeeting,
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  joinMeetingRedirect,
} from '../controllers/meeting.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Public redirect route to enforce meeting timeframe
router.get('/join/:id', joinMeetingRedirect as any);

// All other routes require authentication
router.post('/', authenticate as any, scheduleMeeting);
router.get('/', authenticate as any, getMeetings);
router.get('/:id', authenticate as any, getMeetingById);
router.put('/:id', authenticate as any, updateMeeting);
router.delete('/:id', authenticate as any, deleteMeeting);

export default router;
