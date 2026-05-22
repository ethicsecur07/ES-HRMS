import { Router } from 'express';
import { upload, uploadImage, uploadDocument } from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', authenticate as any, upload.single('image') as any, uploadImage as any);
router.post('/document', authenticate as any, upload.single('document') as any, uploadDocument as any);

export default router;
