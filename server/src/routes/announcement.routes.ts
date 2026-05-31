import { Router } from 'express';
import { getAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcement.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate as any, getAnnouncements as any);
router.post('/', authenticate as any, authorize(['ADMIN', 'HR', 'MANAGER']) as any, createAnnouncement as any);
router.delete('/:id', authenticate as any, authorize(['ADMIN', 'HR', 'MANAGER']) as any, deleteAnnouncement as any);

export default router;
