"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_js_1 = require("./project.controller.js");
const projectCore_controller_js_1 = require("./projectCore.controller.js");
const taskKanban_controller_js_1 = require("./taskKanban.controller.js");
const taskWorkflow_controller_js_1 = require("./taskWorkflow.controller.js");
const taskComment_controller_js_1 = require("./taskComment.controller.js");
const taskActivity_controller_js_1 = require("./taskActivity.controller.js");
const projectAnalytics_controller_js_1 = require("./projectAnalytics.controller.js");
const employeeEligibility_controller_js_1 = require("./employeeEligibility.controller.js");
const rbacGuard_js_1 = require("../../middlewares/rbacGuard.js");
const auth_middleware_js_1 = require("../../middlewares/auth.middleware.js");
const router = (0, express_1.Router)();
// Legacy Analytics / Specialized Routes
router.get('/sprints/:sprintId/burndown', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getSprintBurndown);
router.get('/:projectId/velocity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getTeamVelocity);
router.get('/employees/:employeeId/productivity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), project_controller_js_1.getEmployeeProductivity);
router.post('/:projectId/invoice', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'export'), project_controller_js_1.exportProjectInvoice);
// Project Analytics Dashboard Summaries
router.get('/dashboard/summary', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectAnalytics_controller_js_1.getDashboardSummary);
router.get('/:projectId/analytics', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectAnalytics_controller_js_1.getProjectAnalytics);
router.get('/:projectId/team-workload', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), projectAnalytics_controller_js_1.getTeamWorkload);
router.get('/:projectId/eligible-employees', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), employeeEligibility_controller_js_1.getEligibleEmployees);
router.get('/:projectId/activity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskActivity_controller_js_1.getProjectActivity);
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
router.put('/:projectId/tasks/:taskId/status', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskKanban_controller_js_1.updateTaskStatus); // Allowed for employees with view/edit depending on task assign
router.put('/:projectId/tasks/:taskId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.updateTask);
router.delete('/:projectId/tasks/:taskId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskKanban_controller_js_1.deleteTask);
// Task Workflow (Submit / Approve / Reject)
router.post('/:projectId/tasks/:taskId/submit-review', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskWorkflow_controller_js_1.submitTaskForReview);
router.post('/:projectId/tasks/:taskId/approve', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskWorkflow_controller_js_1.approveTask);
router.post('/:projectId/tasks/:taskId/reject', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'edit'), taskWorkflow_controller_js_1.rejectTask);
// Task Comments
router.get('/:projectId/tasks/:taskId/comments', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskComment_controller_js_1.getTaskComments);
router.post('/:projectId/tasks/:taskId/comments', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskComment_controller_js_1.createComment);
router.put('/:projectId/tasks/:taskId/comments/:commentId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskComment_controller_js_1.updateComment);
router.delete('/:projectId/tasks/:taskId/comments/:commentId', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskComment_controller_js_1.deleteComment);
// Task Activity
router.get('/:projectId/tasks/:taskId/activity', auth_middleware_js_1.authenticate, (0, rbacGuard_js_1.rbacGuard)('PROJECTS', 'view'), taskActivity_controller_js_1.getTaskActivity);
exports.default = router;
