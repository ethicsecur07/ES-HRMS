import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Task } from '../../models/Task.js';
import { getIO } from '../../sockets/socketHandler.js';

export const createTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
      delete req.body.sprintId;
    }
    const task = await Task.create({
      ...req.body,
      projectId: req.params.projectId,
      organizationId: req.user?.organizationId,
    });
    
    // Broadcast via socket
    const io = getIO();
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('task_created', task);
    }

    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
};

export const getProjectTasks = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query: any = { 
      projectId: req.params.projectId, 
      organizationId: req.user?.organizationId 
    };

    if (req.query.sprintId) {
      query.sprintId = req.query.sprintId;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email profileImage')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

export const updateTaskStatus = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status } = req.body;
    
    if (!['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, projectId: req.params.projectId, organizationId: req.user?.organizationId },
      { status },
      { new: true }
    ).populate('assignedTo', 'fullName email profileImage');

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Broadcast update via socket
    const io = getIO();
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('task_updated', task);
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
      req.body.sprintId = null;
    }
    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, projectId: req.params.projectId, organizationId: req.user?.organizationId },
      req.body,
      { new: true }
    ).populate('assignedTo', 'fullName email profileImage');

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const io = getIO();
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('task_updated', task);
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Task.findOneAndDelete({ 
      _id: req.params.taskId, 
      projectId: req.params.projectId, 
      organizationId: req.user?.organizationId 
    });

    const io = getIO();
    if (io) {
      io.to(`project_${req.params.projectId}`).emit('task_deleted', { taskId: req.params.taskId });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
