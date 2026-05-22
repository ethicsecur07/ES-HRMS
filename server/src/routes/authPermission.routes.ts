import { Router } from 'express';
import { getPermissionMatrix, updatePermissionMatrix, getUserOverrides, upsertUserOverride, deleteUserOverride, getMyPermissions, syncPermissions } from '../controllers/authPermission.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate as any);

// Route available to any authenticated user to fetch their own compiled permissions
router.get('/my-permissions', getMyPermissions as any);

// Sync permissions - ADMIN only
router.post('/sync', authorize(['ADMIN']) as any, syncPermissions as any);

// Only ADMIN and HR roles can manage other permissions
router.use(authorize(['ADMIN', 'HR']) as any);

router.get('/matrix', getPermissionMatrix as any);
router.put('/matrix', updatePermissionMatrix as any);
router.get('/overrides', getUserOverrides as any);
router.post('/overrides', upsertUserOverride as any);
router.delete('/overrides', deleteUserOverride as any);

export default router;
