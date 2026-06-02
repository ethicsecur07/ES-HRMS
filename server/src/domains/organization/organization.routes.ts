import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { registerOrganization, updateOrganizationSettings } from './core-org.controller.js';

const router = Router();

// PUBLIC ROUTES (SaaS Tenant Registration)
router.post('/register', registerOrganization as any);

// AUTHENTICATED ROUTES
router.use(authenticate);

// TENANT ADMIN ROUTES
// Note: Only ADMIN role can modify org settings. The controller verifies this via role/permissions or the guard.
router.put('/settings', updateOrganizationSettings as any);

export default router;
