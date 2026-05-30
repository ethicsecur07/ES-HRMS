import { Router } from 'express';
import {
  getSprintBurndown,
  getTeamVelocity,
  getEmployeeProductivity,
  exportProjectInvoice,
} from './project.controller.js';
import {
  createProject,
  getProjects,
  getProjectDetails,
  updateProject,
  deleteProject,
  createSprint,
  getProjectSprints,
  updateSprint,
} from './projectCore.controller.js';
import {
  createTask,
  getProjectTasks,
  updateTaskStatus,
  updateTask,
  deleteTask,
} from './taskKanban.controller.js';
import {
  submitTaskForReview,
  approveTask,
  rejectTask,
} from './taskWorkflow.controller.js';
import {
  getTaskComments,
  createComment,
  updateComment,
  deleteComment,
} from './taskComment.controller.js';
import {
  getTaskActivity,
  getProjectActivity,
} from './taskActivity.controller.js';
import {
  getProjectAnalytics,
  getTeamWorkload,
  getDashboardSummary,
  getEmployeeQuickStats,
} from './projectAnalytics.controller.js';
import { getEligibleEmployees } from './employeeEligibility.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Legacy Analytics / Specialized Routes
router.get('/sprints/:sprintId/burndown', authenticate as any, rbacGuard('PROJECTS', 'view'), getSprintBurndown);
router.get('/:projectId/velocity', authenticate as any, rbacGuard('PROJECTS', 'view'), getTeamVelocity);
router.get('/employees/:employeeId/productivity', authenticate as any, rbacGuard('PROJECTS', 'view'), getEmployeeProductivity);
router.post('/:projectId/invoice', authenticate as any, rbacGuard('PROJECTS', 'export'), exportProjectInvoice);

// Project Analytics Dashboard Summaries
router.get('/dashboard/summary', authenticate as any, rbacGuard('PROJECTS', 'view'), getDashboardSummary);
router.get('/employee/quick-stats', authenticate as any, getEmployeeQuickStats);
router.get('/:projectId/analytics', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjectAnalytics);
router.get('/:projectId/team-workload', authenticate as any, rbacGuard('PROJECTS', 'view'), getTeamWorkload);
router.get('/:projectId/eligible-employees', authenticate as any, rbacGuard('PROJECTS', 'view'), getEligibleEmployees);
router.get('/:projectId/activity', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjectActivity);

// Project Core CRUD
router.post('/', authenticate as any, rbacGuard('PROJECTS', 'create'), createProject);
router.get('/', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjects);
router.get('/:projectId', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjectDetails);
router.put('/:projectId', authenticate as any, rbacGuard('PROJECTS', 'edit'), updateProject);
router.delete('/:projectId', authenticate as any, rbacGuard('PROJECTS', 'delete'), deleteProject);

// Sprints
router.post('/:projectId/sprints', authenticate as any, rbacGuard('PROJECTS', 'edit'), createSprint);
router.get('/:projectId/sprints', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjectSprints);
router.put('/:projectId/sprints/:sprintId', authenticate as any, rbacGuard('PROJECTS', 'edit'), updateSprint);

// Task Kanban CRUD
router.post('/:projectId/tasks', authenticate as any, rbacGuard('PROJECTS', 'edit'), createTask);
router.get('/:projectId/tasks', authenticate as any, rbacGuard('PROJECTS', 'view'), getProjectTasks);
router.put('/:projectId/tasks/:taskId/status', authenticate as any, rbacGuard('PROJECTS', 'view'), updateTaskStatus); // Allowed for employees with view/edit depending on task assign
router.put('/:projectId/tasks/:taskId', authenticate as any, rbacGuard('PROJECTS', 'edit'), updateTask);
router.delete('/:projectId/tasks/:taskId', authenticate as any, rbacGuard('PROJECTS', 'edit'), deleteTask);

// Task Workflow (Submit / Approve / Reject)
router.post('/:projectId/tasks/:taskId/submit-review', authenticate as any, rbacGuard('PROJECTS', 'view'), submitTaskForReview);
router.post('/:projectId/tasks/:taskId/approve', authenticate as any, rbacGuard('PROJECTS', 'edit'), approveTask);
router.post('/:projectId/tasks/:taskId/reject', authenticate as any, rbacGuard('PROJECTS', 'edit'), rejectTask);

// Task Comments
router.get('/:projectId/tasks/:taskId/comments', authenticate as any, rbacGuard('PROJECTS', 'view'), getTaskComments);
router.post('/:projectId/tasks/:taskId/comments', authenticate as any, rbacGuard('PROJECTS', 'view'), createComment);
router.put('/:projectId/tasks/:taskId/comments/:commentId', authenticate as any, rbacGuard('PROJECTS', 'view'), updateComment);
router.delete('/:projectId/tasks/:taskId/comments/:commentId', authenticate as any, rbacGuard('PROJECTS', 'view'), deleteComment);

// Task Activity
router.get('/:projectId/tasks/:taskId/activity', authenticate as any, rbacGuard('PROJECTS', 'view'), getTaskActivity);

export default router;
