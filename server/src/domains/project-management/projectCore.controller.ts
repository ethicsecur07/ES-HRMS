import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Project } from '../../models/Project.js';
import { Sprint } from '../../models/project-management/Sprint.js';
import { Employee } from '../../models/Employee.js';
import { isDeptEligible } from './employeeEligibility.controller.js';
import { createAuditLog } from '../../services/auditLog.service.js';
import { notificationService } from '../../services/notification.service.js';
import { Task } from '../../models/Task.js';

export const createProject = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId as any;
    const { name, teamMemberIds, projectType } = req.body;

    // Department-Role Mapping Validation
    if (teamMemberIds && teamMemberIds.length > 0 && projectType) {
      const employees = await Employee.find({ _id: { $in: teamMemberIds }, organizationId });
      for (const emp of employees) {
        if (!isDeptEligible(projectType, emp.department)) {
          res.status(400).json({
            message: `Employee ${emp.fullName} from department "${emp.department}" is not eligible for a "${projectType}" project.`,
          });
          return;
        }
      }
    }

    const project = await Project.create({
      ...req.body,
      organizationId,
    });

    // Audit Log
    await createAuditLog(
      'PROJECT_CREATED',
      req.user?.email || 'unknown',
      'PROJECTS',
      project._id.toString(),
      `Project "${name}" created.`,
      organizationId
    );

    // Notify Allocated Manager
    if (project.allocatedManagerId) {
      await notificationService.dispatchNotification({
        organizationId,
        recipientId: project.allocatedManagerId.toString(),
        title: 'Project Assigned',
        message: `You have been allocated as Manager for project "${project.name}".`,
        channels: ['IN_APP', 'EMAIL'],
        type: 'PROJECT_CREATED',
        payload: { projectId: project._id },
      });
    }

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

export const getProjects = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId;
    const role = req.user?.role;
    const employeeId = (req.user as any)?.employeeId;

    let query: any = { organizationId };

    const { RoleMember } = await import('../../models/RoleMember.js');
    const roleCodes = role ? [role] : [];
    const customMembers = await RoleMember.find({
      organizationId,
      userId: req.user?.id
    }).populate('roleId');

    for (const cm of customMembers) {
      const roleObj = cm.roleId as any;
      if (roleObj && roleObj.code) {
        roleCodes.push(roleObj.code);
      }
    }

    const hasManagementRole = roleCodes.some(code => ['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD'].includes(code));

    if (!hasManagementRole && employeeId) {
      const employee = await Employee.findById(employeeId);
      if (employee) {
        // Detect if the employee is an Intern
        const isIntern = /intern/i.test(employee.designation || '') || /intern/i.test(employee.department || '');
        if (isIntern) {
          query.$or = [
            { teamMemberIds: employeeId },
            { projectType: { $regex: /intern/i } }
          ];
        } else {
          query.teamMemberIds = employeeId;
        }
      } else {
        query.teamMemberIds = employeeId;
      }
    }

    const projects = await Project.find(query)
      .populate('allocatedManagerId', 'name email')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

export const getProjectDetails = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, organizationId: req.user?.organizationId })
      .populate('allocatedManagerId', 'name email')
      .populate('teamMemberIds', 'fullName email department designation');
    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const updateProject = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId as any;
    const { teamMemberIds, projectType, name } = req.body;

    // Department-Role Mapping Validation
    if (teamMemberIds && teamMemberIds.length > 0) {
      // Find current or new project type
      const currentProj = await Project.findOne({ _id: req.params.projectId, organizationId });
      const pType = projectType || currentProj?.projectType;

      if (pType) {
        const employees = await Employee.find({ _id: { $in: teamMemberIds }, organizationId });
        for (const emp of employees) {
          if (!isDeptEligible(pType, emp.department)) {
            res.status(400).json({
              message: `Employee ${emp.fullName} from department "${emp.department}" is not eligible for a "${pType}" project.`,
            });
            return;
          }
        }
      }
    }

    const project = await Project.findOneAndUpdate(
      { _id: req.params.projectId, organizationId },
      req.body,
      { new: true }
    );

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    // Audit Log
    await createAuditLog(
      'PROJECT_UPDATED',
      req.user?.email || 'unknown',
      'PROJECTS',
      project._id.toString(),
      `Project "${project.name}" updated.`,
      organizationId
    );

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.user?.organizationId as any;
    const project = await Project.findOneAndDelete({ _id: req.params.projectId, organizationId });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    // Audit Log
    await createAuditLog(
      'PROJECT_DELETED',
      req.user?.email || 'unknown',
      'PROJECTS',
      project._id.toString(),
      `Project "${project.name}" deleted.`,
      organizationId
    );

    // Cascade delete sprints and tasks
    await Sprint.deleteMany({ projectId: req.params.projectId, organizationId });
    await Task.deleteMany({ projectId: req.params.projectId, organizationId });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Sprints
export const createSprint = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprint = await Sprint.create({
      ...req.body,
      projectId: req.params.projectId,
      organizationId: req.user?.organizationId,
    });
    res.status(201).json({ sprint });
  } catch (err) {
    next(err);
  }
};

export const getProjectSprints = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprints = await Sprint.find({
      projectId: req.params.projectId,
      organizationId: req.user?.organizationId,
    }).sort({ startDate: 1 });
    res.json({ sprints });
  } catch (err) {
    next(err);
  }
};

export const updateSprint = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprint = await Sprint.findOneAndUpdate(
      { _id: req.params.sprintId, projectId: req.params.projectId, organizationId: req.user?.organizationId },
      req.body,
      { new: true }
    );
    res.json({ sprint });
  } catch (err) {
    next(err);
  }
};
