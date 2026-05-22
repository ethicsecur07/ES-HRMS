"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const WorkflowController = __importStar(require("./workflow.controller.js"));
const router = (0, express_1.Router)();
// Apply authentication middleware globally to all workflow routes
router.use(auth_middleware_js_1.authenticate);
// Workflow Templates Marketplace
router.get('/templates/marketplace', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'view'), WorkflowController.getMarketplace);
router.post('/templates/marketplace/install', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'create'), WorkflowController.installFromMarketplace);
// Workflow Templates
router.post('/templates', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'create'), WorkflowController.createTemplate);
router.get('/templates', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'view'), WorkflowController.listTemplates);
router.put('/templates/:id', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'edit'), WorkflowController.updateTemplate);
router.post('/templates/:id/duplicate', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'create'), WorkflowController.duplicateTemplate);
router.post('/templates/:id/publish', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'edit'), WorkflowController.publishTemplate);
router.post('/templates/:id/toggle', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'edit'), WorkflowController.toggleTemplate);
// Workflow Instances
router.post('/instances', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'create'), WorkflowController.createInstance);
router.get('/instances', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'view'), WorkflowController.listInstances);
router.get('/instances/:instanceId', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'view'), WorkflowController.getInstance);
router.post('/instances/:instanceId/actions', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'approve'), WorkflowController.actOnNode);
// Workflow SLA & Monitor
router.post('/sla/sweep', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'create'), WorkflowController.triggerSlaSweep);
// Workflow Analytics & Exports
router.get('/analytics', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'view'), WorkflowController.getWorkflowAnalytics);
router.get('/exports', (0, rbacGuard_js_1.rbacGuard)('WORKFLOW', 'export'), WorkflowController.exportInstances);
exports.default = router;
