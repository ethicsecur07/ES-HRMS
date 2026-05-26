import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Task } from '../../models/Task.js';
import { Project } from '../../models/Project.js';
import { User } from '../../models/User.js';
import { TaskActivity } from '../../models/TaskActivity.js';
import { notificationService } from '../../services/notification.service.js';
import { getIO } from '../../sockets/socketHandler.js';
import { createAuditLog } from '../../services/auditLog.service.js';

export const createTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId as any;

    if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
      delete req.body.sprintId;
    }

    const task = await Task.create({
      ...req.body,
      projectId,
      organizationId,
    });

    const populatedTask = await Task.findById(task._id).populate('assignedTo', 'fullName email profileImage');

    const user = await User.findById(req.user?.id);
    const actorName = user ? user.name : 'Unknown';

    // Log Activity
    await TaskActivity.create({
      organizationId,
      projectId,
      taskId: task._id,
      actorId: req.user?.id,
      actorName,
      action: 'CREATED',
    });

    // Notify assigned employee
    if (task.assignedTo) {
      const assignedUser = await User.findOne({ employeeId: task.assignedTo, organizationId });
      if (assignedUser) {
        await notificationService.dispatchNotification({
          organizationId,
          recipientId: assignedUser._id.toString(),
          title: 'New Task Assigned',
          message: `You have been assigned the task: "${task.title}".`,
          channels: ['IN_APP', 'EMAIL'],
          type: 'TASK_ASSIGNED',
          payload: { taskId: task._id, projectId },
        });

        // Log Assignment Activity
        await TaskActivity.create({
          organizationId,
          projectId,
          taskId: task._id,
          actorId: req.user?.id,
          actorName,
          action: 'ASSIGNED',
          to: assignedUser.name,
        });
      }
    }

    // Broadcast via socket
    const io = getIO();
    if (io) {
      io.to(`project_${projectId}`).emit('task_created', populatedTask);
    }

    res.status(201).json({ task: populatedTask });
  } catch (err) {
    next(err);
  }
};

export const getProjectTasks = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const organizationId = req.user?.organizationId;

    const query: any = {
      projectId,
      organizationId,
    };

    if (req.query.sprintId) {
      if (req.query.sprintId === 'backlog') {
        query.sprintId = { $exists: false };
      } else {
        query.sprintId = req.query.sprintId;
      }
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email department designation profileImage')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (err) {
    next(err);
  }
};

export const updateTaskStatus = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const { status } = req.body;
    const organizationId = req.user?.organizationId as any;
    const userRole = req.user?.role || '';

    if (!['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const task = await Task.findOne({ _id: taskId, projectId, organizationId });
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const fromStatus = task.status;

    // Role-based status transition restrictions
    const dbUser = await User.findById(req.user?.id);
    const actorName = dbUser ? dbUser.name : 'Unknown';

    if (userRole === 'ADMIN') {
      res.status(403).json({ message: 'Admins cannot modify task status' });
      return;
    }

    if (userRole === 'EMPLOYEE') {
      // Check assignment
      const isAssigned =
        task.assignedTo && dbUser?.employeeId && task.assignedTo.toString() === dbUser.employeeId.toString();

      if (!isAssigned) {
        res.status(403).json({ message: 'Employees can only drag their assigned tasks' });
        return;
      }

      // Allowed transitions: TODO -> IN_PROGRESS, IN_PROGRESS -> REVIEW, REVIEW -> TODO (back to rework)
      const allowed =
        (fromStatus === 'TODO' && status === 'IN_PROGRESS') ||
        (fromStatus === 'IN_PROGRESS' && status === 'REVIEW') ||
        (fromStatus === 'REVIEW' && status === 'TODO'); // Returning to todo is fine if employee restarts or rejects

      // Employees cannot move to COMPLETED directly
      if (status === 'COMPLETED') {
        res.status(403).json({ message: 'Employees cannot approve tasks to COMPLETED. Team Lead review is required.' });
        return;
      }

      if (!allowed) {
        res.status(403).json({ message: `Employees are not allowed to transition tasks from ${fromStatus} to ${status}.` });
        return;
      }
    }

    task.status = status as any;
    await task.save();

    const populatedTask = await Task.findById(task._id).populate('assignedTo', 'fullName email profileImage');

    // Create Activity Log
    await TaskActivity.create({
      organizationId,
      projectId,
      taskId: task._id,
      actorId: req.user?.id,
      actorName,
      action: 'STATUS_CHANGED',
      from: fromStatus,
      to: status,
    });

    // Broadcast update via socket
    const io = getIO();
    if (io) {
      io.to(`project_${projectId}`).emit('task_updated', populatedTask);
    }

    res.json({ task: populatedTask });
  } catch (err) {
    next(err);
  }
};

export const updateTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const organizationId = req.user?.organizationId as any;

    const task = await Task.findOne({ _id: taskId, projectId, organizationId });
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const previousAssignee = task.assignedTo?.toString();
    const previousDueDate = task.dueDate;
    const previousPriority = task.priority;

    if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
      req.body.sprintId = null;
      req.body.sprintName = null;
    }

    const updatedTask = await Task.findOneAndUpdate(
      { _id: taskId, projectId, organizationId },
      req.body,
      { new: true }
    ).populate('assignedTo', 'fullName email profileImage');

    if (!updatedTask) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const dbUser = await User.findById(req.user?.id);
    const actorName = dbUser ? dbUser.name : 'Unknown';

    // Activity Log & Notification for Assignment change
    if (req.body.assignedTo && req.body.assignedTo !== previousAssignee) {
      const assignedUser = await User.findOne({ employeeId: req.body.assignedTo, organizationId });
      if (assignedUser) {
        await notificationService.dispatchNotification({
          organizationId,
          recipientId: assignedUser._id.toString(),
          title: 'Task Assigned',
          message: `Task "${updatedTask.title}" has been assigned to you.`,
          channels: ['IN_APP', 'EMAIL'],
          type: 'TASK_ASSIGNED',
          payload: { taskId: updatedTask._id, projectId },
        });

        await TaskActivity.create({
          organizationId,
          projectId,
          taskId: updatedTask._id,
          actorId: req.user?.id,
          actorName,
          action: 'ASSIGNED',
          to: assignedUser.name,
        });
      }
    }

    // Activity Log & Notification for Due Date change
    if (req.body.dueDate && req.body.dueDate !== previousDueDate) {
      await TaskActivity.create({
        organizationId,
        projectId,
        taskId: updatedTask._id,
        actorId: req.user?.id,
        actorName,
        action: 'DEADLINE_UPDATED',
        from: previousDueDate,
        to: req.body.dueDate,
      });

      if (updatedTask.assignedTo) {
        const assignedUser = await User.findOne({ employeeId: updatedTask.assignedTo, organizationId });
        if (assignedUser) {
          await notificationService.dispatchNotification({
            organizationId,
            recipientId: assignedUser._id.toString(),
            title: 'Task Deadline Updated',
            message: `The deadline for task "${updatedTask.title}" is now ${req.body.dueDate}.`,
            channels: ['IN_APP'],
            type: 'DEADLINE_UPDATED',
            payload: { taskId: updatedTask._id, projectId },
          });
        }
      }
    }

    // Activity Log for Priority change
    if (req.body.priority && req.body.priority !== previousPriority) {
      await TaskActivity.create({
        organizationId,
        projectId,
        taskId: updatedTask._id,
        actorId: req.user?.id,
        actorName,
        action: 'PRIORITY_CHANGED',
        from: previousPriority,
        to: req.body.priority,
      });
    }

    // Generic Update Log
    await TaskActivity.create({
      organizationId,
      projectId,
      taskId: updatedTask._id,
      actorId: req.user?.id,
      actorName,
      action: 'UPDATED',
    });

    const io = getIO();
    if (io) {
      io.to(`project_${projectId}`).emit('task_updated', updatedTask);
    }

    res.json({ task: updatedTask });
  } catch (err) {
    next(err);
  }
};

export const deleteTask = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const organizationId = req.user?.organizationId as any;

    const task = await Task.findOneAndDelete({
      _id: taskId,
      projectId,
      organizationId,
    });

    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    // Audit Log
    await createAuditLog(
      'TASK_DELETED',
      req.user?.email || 'unknown',
      'PROJECTS',
      task._id.toString(),
      `Task "${task.title}" deleted.`,
      organizationId
    );

    // Delete associated comments and activities
    await TaskActivity.deleteMany({ taskId, projectId, organizationId });

    const io = getIO();
    if (io) {
      io.to(`project_${projectId}`).emit('task_deleted', { taskId });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
