import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { moduleGuard } from '../../middlewares/moduleGuard.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { registerOrganization, updateOrganizationSettings } from './core-org.controller.js';
import {
  getOrgStructureData,
  createBranch,
  updateBranch,
  deleteBranch,
  createDivision,
  updateDivision,
  deleteDivision,
  createBusinessUnit,
  updateBusinessUnit,
  deleteBusinessUnit,
  createCostCenter,
  updateCostCenter,
  deleteCostCenter,
  saveReportingHierarchy,
} from './organization.controller.js';

const router = Router();

// PUBLIC ROUTES (SaaS Tenant Registration)
router.post('/register', registerOrganization as any);

// AUTHENTICATED ROUTES
router.use(authenticate);

// TENANT ADMIN ROUTES
// Note: Only ADMIN role can modify org settings. The controller verifies this via role/permissions or the guard.
router.put('/settings', updateOrganizationSettings as any);

// Apply module verification to all structural organization routes
router.use(moduleGuard(['ORG_STRUCTURE']));

// Tree Hierarchy and structure summary
router.get('/', rbacGuard('ORG_STRUCTURE', 'view'), getOrgStructureData);

// Branch endpoints
router.post('/branch', rbacGuard('ORG_STRUCTURE', 'create'), createBranch);
router.put('/branch/:id', rbacGuard('ORG_STRUCTURE', 'edit'), updateBranch);
router.delete('/branch/:id', rbacGuard('ORG_STRUCTURE', 'delete'), deleteBranch);

// Division endpoints
router.post('/division', rbacGuard('ORG_STRUCTURE', 'create'), createDivision);
router.put('/division/:id', rbacGuard('ORG_STRUCTURE', 'edit'), updateDivision);
router.delete('/division/:id', rbacGuard('ORG_STRUCTURE', 'delete'), deleteDivision);

// Business Unit endpoints
router.post('/business-unit', rbacGuard('ORG_STRUCTURE', 'create'), createBusinessUnit);
router.put('/business-unit/:id', rbacGuard('ORG_STRUCTURE', 'edit'), updateBusinessUnit);
router.delete('/business-unit/:id', rbacGuard('ORG_STRUCTURE', 'delete'), deleteBusinessUnit);

// Cost Center endpoints
router.post('/cost-center', rbacGuard('ORG_STRUCTURE', 'create'), createCostCenter);
router.put('/cost-center/:id', rbacGuard('ORG_STRUCTURE', 'edit'), updateCostCenter);
router.delete('/cost-center/:id', rbacGuard('ORG_STRUCTURE', 'delete'), deleteCostCenter);

// Hierarchy Assignment
router.post('/hierarchy', rbacGuard('ORG_STRUCTURE', 'assign'), saveReportingHierarchy);

export default router;
