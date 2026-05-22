import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import * as WorkflowController from './workflow.controller.js';

const router = Router();

// Apply authentication middleware globally to all workflow routes
router.use(authenticate as any);

// Workflow Templates Marketplace
router.get('/templates/marketplace', rbacGuard('WORKFLOW', 'view') as any, WorkflowController.getMarketplace as any);
router.post('/templates/marketplace/install', rbacGuard('WORKFLOW', 'create') as any, WorkflowController.installFromMarketplace as any);

// Workflow Templates
router.post('/templates', rbacGuard('WORKFLOW', 'create') as any, WorkflowController.createTemplate as any);
router.get('/templates', rbacGuard('WORKFLOW', 'view') as any, WorkflowController.listTemplates as any);
router.put('/templates/:id', rbacGuard('WORKFLOW', 'edit') as any, WorkflowController.updateTemplate as any);
router.post('/templates/:id/duplicate', rbacGuard('WORKFLOW', 'create') as any, WorkflowController.duplicateTemplate as any);
router.post('/templates/:id/publish', rbacGuard('WORKFLOW', 'edit') as any, WorkflowController.publishTemplate as any);
router.post('/templates/:id/toggle', rbacGuard('WORKFLOW', 'edit') as any, WorkflowController.toggleTemplate as any);

// Workflow Instances
router.post('/instances', rbacGuard('WORKFLOW', 'create') as any, WorkflowController.createInstance as any);
router.get('/instances', rbacGuard('WORKFLOW', 'view') as any, WorkflowController.listInstances as any);
router.get('/instances/:instanceId', rbacGuard('WORKFLOW', 'view') as any, WorkflowController.getInstance as any);
router.post('/instances/:instanceId/actions', rbacGuard('WORKFLOW', 'approve') as any, WorkflowController.actOnNode as any);

// Workflow SLA & Monitor
router.post('/sla/sweep', rbacGuard('WORKFLOW', 'create') as any, WorkflowController.triggerSlaSweep as any);

// Workflow Analytics & Exports
router.get('/analytics', rbacGuard('WORKFLOW', 'view') as any, WorkflowController.getWorkflowAnalytics as any);
router.get('/exports', rbacGuard('WORKFLOW', 'export') as any, WorkflowController.exportInstances as any);

export default router;

