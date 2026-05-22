"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_js_1 = require("./project.controller.js");
const projectCore_controller_js_1 = require("./projectCore.controller.js");
const taskKanban_controller_js_1 = require("./taskKanban.controller.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Legacy Analytics / Specialized Routes
router.get('/sprints/:sprintId/burndown', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getSprintBurndown);
router.get('/:projectId/velocity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getTeamVelocity);
router.get('/employees/:employeeId/productivity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getEmployeeProductivity);
router.post('/:projectId/invoice', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'export'), project_controller_js_1.exportProjectInvoice);
// Project Core CRUD
router.post('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'create'), projectCore_controller_js_1.createProject);
router.get('/', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectCore_controller_js_1.getProjects);
router.get('/:projectId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectCore_controller_js_1.getProjectDetails);
router.put('/:projectId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), projectCore_controller_js_1.updateProject);
router.delete('/:projectId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'delete'), projectCore_controller_js_1.deleteProject);
// Sprints
router.post('/:projectId/sprints', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), projectCore_controller_js_1.createSprint);
router.get('/:projectId/sprints', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectCore_controller_js_1.getProjectSprints);
router.put('/:projectId/sprints/:sprintId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), projectCore_controller_js_1.updateSprint);
// Task Kanban CRUD
router.post('/:projectId/tasks', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.createTask);
router.get('/:projectId/tasks', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskKanban_controller_js_1.getProjectTasks);
router.put('/:projectId/tasks/:taskId/status', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.updateTaskStatus); // Kanban drag-drop
router.put('/:projectId/tasks/:taskId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.updateTask);
router.delete('/:projectId/tasks/:taskId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.deleteTask);
exports.default = router;
