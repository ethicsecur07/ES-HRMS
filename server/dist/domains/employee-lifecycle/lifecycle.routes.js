"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const moduleGuard_js_1 = require("../../middlewares/moduleGuard.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const lifecycle_controller_js_1 = require("./lifecycle.controller.js");
const router = (0, express_1.Router)();
router.use(auth_middleware_js_1.authenticate);
router.use((0, moduleGuard_js_1.moduleGuard)(['EMPLOYEE_LIFECYCLE']));
// Retrieve all workflows
router.get('/', (0, rbacGuard_js_1.rbacGuard)('EMPLOYEE_LIFECYCLE', 'view'), lifecycle_controller_js_1.getLifecycleTrackers);
// Trigger a new lifecycle (Onboarding induction, Resignation notice, etc.)
router.post('/', (0, rbacGuard_js_1.rbacGuard)('EMPLOYEE_LIFECYCLE', 'create'), lifecycle_controller_js_1.createLifecycleTracker);
// Update details on a specific workflow (Probation confirming updates, promotion levels, etc.)
router.put('/:id', (0, rbacGuard_js_1.rbacGuard)('EMPLOYEE_LIFECYCLE', 'edit'), lifecycle_controller_js_1.updateLifecycleDetails);
// Complete or skip checklist items
router.put('/:trackerId/step/:stepId', (0, rbacGuard_js_1.rbacGuard)('EMPLOYEE_LIFECYCLE', 'edit'), lifecycle_controller_js_1.updateLifecycleStep);
exports.default = router;
