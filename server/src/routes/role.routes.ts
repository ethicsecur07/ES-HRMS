import { Router } from 'express';
import { getRoles, getRoleById, createRole, updateRole, deleteRole, getRoleMembers, updateRoleMembers } from '../controllers/role.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

// Only ADMIN and HR roles can manage system roles
router.use(authenticate as any);
router.use(authorize(['ADMIN', 'HR']) as any);

router.get('/', getRoles as any);
router.get('/:id', getRoleById as any);
router.post('/', createRole as any);
router.put('/:id', updateRole as any);
router.delete('/:id', deleteRole as any);

router.get('/:id/members', getRoleMembers as any);
router.post('/:id/members', updateRoleMembers as any);

export default router;
