import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Project } from '../../models/Project.js';
import { Task } from '../../models/Task.js';
import { Sprint } from '../../models/project-management/Sprint.js';
import { Employee } from '../../models/Employee.js';

export const getProjectAnalytics = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId;

    const project = await Project.findOne({ _id: projectId, organizationId });
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const tasks = await Task.find({ projectId, organizationId });
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewTasks = tasks.filter((t) => t.status === 'REVIEW').length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate < todayStr);

    const sprints = await Sprint.find({ projectId, organizationId }).sort({ startDate: 1 });
    const sprintProgress = sprints.map((sprint) => {
      const sprintTasks = tasks.filter((t) => t.sprintId?.toString() === sprint._id.toString());
      const sTotal = sprintTasks.length;
      const sCompleted = sprintTasks.filter((t) => t.status === 'COMPLETED').length;
      const sRate = sTotal > 0 ? Math.round((sCompleted / sTotal) * 100) : 0;
      return {
        _id: sprint._id,
        name: sprint.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
        totalTasks: sTotal,
        completedTasks: sCompleted,
        completionRate: sRate,
      };
    });

    res.json({
      analytics: {
        completionRate,
        totalTasks,
        completedTasks,
        todoTasks,
        inProgressTasks,
        reviewTasks,
        overdueCount: overdueTasks.length,
        overdueTasks: overdueTasks.map((t) => ({
          _id: t._id,
          title: t.title,
          dueDate: t.dueDate,
          priority: t.priority,
          status: t.status,
        })),
        sprintProgress,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getTeamWorkload = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId;

    const project = await Project.findOne({ _id: projectId, organizationId });
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const tasks = await Task.find({ projectId, organizationId }).populate('assignedTo', 'fullName email');

    // Group workload by employee
    const workloadMap = new Map<string, { employeeName: string; TODO: number; IN_PROGRESS: number; REVIEW: number; COMPLETED: number; total: number }>();

    // Initialize with all team members to ensure everyone appears in workload chart
    const members = await Employee.find({ _id: { $in: project.teamMemberIds } });
    members.forEach((m) => {
      workloadMap.set(m._id.toString(), {
        employeeName: m.fullName,
        TODO: 0,
        IN_PROGRESS: 0,
        REVIEW: 0,
        COMPLETED: 0,
        total: 0,
      });
    });

    tasks.forEach((t) => {
      if (!t.assignedTo) return;
      const empId = t.assignedTo._id.toString();
      const empName = (t.assignedTo as any).fullName || 'Unassigned';

      if (!workloadMap.has(empId)) {
        workloadMap.set(empId, {
          employeeName: empName,
          TODO: 0,
          IN_PROGRESS: 0,
          REVIEW: 0,
          COMPLETED: 0,
          total: 0,
        });
      }

      const stats = workloadMap.get(empId)!;
      stats[t.status]++;
      stats.total++;
    });

    res.json({ workload: Array.from(workloadMap.values()) });
  } catch (err) {
    next(err);
  }
};

export const getDashboardSummary = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;

    const projects = await Project.find({ organizationId });
    const tasks = await Task.find({ organizationId });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
    const planningProjects = projects.filter((p) => p.status === 'PLANNING').length;

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const reviewTasks = tasks.filter((t) => t.status === 'REVIEW').length;

    const overallTaskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      summary: {
        totalProjects,
        activeProjects,
        completedProjects,
        planningProjects,
        totalTasks,
        completedTasks,
        todoTasks,
        inProgressTasks,
        reviewTasks,
        overallTaskCompletionRate,
      },
    });
  } catch (err) {
    next(err);
  }
};
