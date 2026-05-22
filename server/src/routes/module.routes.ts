import { Router } from 'express';
import { getEnabledModules, getModuleRoutes } from '../controllers/module.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/enabled', authenticate as any, getEnabledModules as any);
router.get('/routes', authenticate as any, getModuleRoutes as any);

export default router;
