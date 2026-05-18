import { Router } from 'express';
import { login, logout, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', login as any);
router.post('/logout', authenticate as any, logout as any);
router.get('/me', authenticate as any, getMe as any);

export default router;
