"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const moduleGuard_js_1 = require("../../middlewares/moduleGuard.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const core_org_controller_js_1 = require("./core-org.controller.js");
const organization_controller_js_1 = require("./organization.controller.js");
const router = (0, express_1.Router)();
// PUBLIC ROUTES (SaaS Tenant Registration)
router.post('/register', core_org_controller_js_1.registerOrganization);
// AUTHENTICATED ROUTES
router.use(auth_middleware_js_1.authenticate);
// TENANT ADMIN ROUTES
// Note: Only ADMIN role can modify org settings. The controller verifies this via role/permissions or the guard.
router.put('/settings', core_org_controller_js_1.updateOrganizationSettings);
// Apply module verification to all structural organization routes
router.use((0, moduleGuard_js_1.moduleGuard)(['ORG_STRUCTURE']));
// Tree Hierarchy and structure summary
router.get('/', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'view'), organization_controller_js_1.getOrgStructureData);
// Branch endpoints
router.post('/branch', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'create'), organization_controller_js_1.createBranch);
router.put('/branch/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'edit'), organization_controller_js_1.updateBranch);
router.delete('/branch/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'delete'), organization_controller_js_1.deleteBranch);
// Division endpoints
router.post('/division', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'create'), organization_controller_js_1.createDivision);
router.put('/division/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'edit'), organization_controller_js_1.updateDivision);
router.delete('/division/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'delete'), organization_controller_js_1.deleteDivision);
// Business Unit endpoints
router.post('/business-unit', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'create'), organization_controller_js_1.createBusinessUnit);
router.put('/business-unit/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'edit'), organization_controller_js_1.updateBusinessUnit);
router.delete('/business-unit/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'delete'), organization_controller_js_1.deleteBusinessUnit);
// Cost Center endpoints
router.post('/cost-center', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'create'), organization_controller_js_1.createCostCenter);
router.put('/cost-center/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'edit'), organization_controller_js_1.updateCostCenter);
router.delete('/cost-center/:id', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'delete'), organization_controller_js_1.deleteCostCenter);
// Hierarchy Assignment
router.post('/hierarchy', (0, rbacGuard_js_1.rbacGuard)('ORG_STRUCTURE', 'assign'), organization_controller_js_1.saveReportingHierarchy);
exports.default = router;
