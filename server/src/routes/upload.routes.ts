import { Router } from 'express';
import { upload, uploadImage } from '../controllers/upload.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/', authenticate as any, upload.single('image') as any, uploadImage as any);

export default router;
