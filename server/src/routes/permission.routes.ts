import { Router } from 'express';
import { applyPermission, getPermissions, updatePermissionStatus } from '../controllers/permission.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/apply', authenticate as any, applyPermission as any);
router.get('/', authenticate as any, getPermissions as any);
router.put('/:id/status', authenticate as any, authorize(['ADMIN', 'HR']) as any, updatePermissionStatus as any);

export default router;
