import { Router } from 'express';
import { login, logout, getMe, updateMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', login as any);
router.post('/logout', authenticate as any, logout as any);
router.get('/me', authenticate as any, getMe as any);
router.put('/me', authenticate as any, updateMe as any);

export default router;
