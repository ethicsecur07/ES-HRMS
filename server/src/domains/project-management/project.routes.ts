import { Router } from 'express';
import { getSprintBurndown, getTeamVelocity, getEmployeeProductivity, exportProjectInvoice } from './project.controller.js';
import { 
  createProject, getProjects, getProjectDetails, updateProject, deleteProject,
  createSprint, getProjectSprints, updateSprint 
} from './projectCore.controller.js';
import { 
  createTask, getProjectTasks, updateTaskStatus, updateTask, deleteTask 
} from './taskKanban.controller.js';
import { rbacGuard } from '../../middlewares/rbacGuard.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Legacy Analytics / Specialized Routes
router.get('/sprints/:sprintId/burndown', authenticate as any, rbacGuard('PROJECTS', 'view'), getSprintBurndown);
router.get('/:projectId/velocity', authenticate as any, rbacGuard('PROJECTS', 'view'), getTeamVelocity);
router.get('/employees/:employeeId/productivity', authenticate as any, rbacGuard('PROJECTS', 'view'), getEmployeeProductivity);
router.post('/:projectId/invoice', authenticate as any, rbacGuard('PROJECTS', 'export'), exportProjectInvoice);

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
router.put('/:projectId/tasks/:taskId/status', authenticate as any, rbacGuard('PROJECTS', 'edit'), updateTaskStatus); // Kanban drag-drop
router.put('/:projectId/tasks/:taskId', authenticate as any, rbacGuard('PROJECTS', 'edit'), updateTask);
router.delete('/:projectId/tasks/:taskId', authenticate as any, rbacGuard('PROJECTS', 'edit'), deleteTask);

export default router;
