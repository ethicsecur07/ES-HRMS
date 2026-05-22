import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Project } from '../../models/Project.js';
import { Sprint } from '../../models/project-management/Sprint.js';

export const createProject = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.create({
      ...req.body,
      organizationId: req.user?.organizationId,
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

export const getProjects = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projects = await Project.find({ organizationId: req.user?.organizationId })
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
      .populate('teamMemberIds', 'fullName email');
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
    const project = await Project.findOneAndUpdate(
      { _id: req.params.projectId, organizationId: req.user?.organizationId },
      req.body,
      { new: true }
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

export const deleteProject = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Project.findOneAndDelete({ _id: req.params.projectId, organizationId: req.user?.organizationId });
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
