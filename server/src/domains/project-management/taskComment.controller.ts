import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { TaskComment } from '../../models/TaskComment.js';
import { User } from '../../models/User.js';
import { TaskActivity } from '../../models/TaskActivity.js';
import { getIO } from '../../sockets/socketHandler.js';

export const getTaskComments = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const comments = await TaskComment.find({
      projectId,
      taskId,
      organizationId: req.user?.organizationId,
    }).sort({ createdAt: 1 }); // Chronological order

    res.json({ comments });
  } catch (err) {
    next(err);
  }
};

export const createComment = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId } = req.params;
    const { content, attachments } = req.body;
    const organizationId = req.user?.organizationId;

    if (!content || content.trim() === '') {
      res.status(400).json({ message: 'Comment content is required' });
      return;
    }

    const user = await User.findById(req.user?.id);
    const authorName = user ? user.name : 'Unknown User';

    const comment = await TaskComment.create({
      organizationId,
      projectId,
      taskId,
      authorId: req.user?.id,
      authorName,
      content,
      attachments,
    });

    // Create TaskActivity Log
    await TaskActivity.create({
      organizationId,
      projectId,
      taskId,
      actorId: req.user?.id,
      actorName: authorName,
      action: 'COMMENTED',
      comment: content,
    });

    // Optional: Realtime Socket Broadcast
    const io = getIO();
    if (io) {
      io.to(`project_${projectId}`).emit('task_comment_created', { taskId, comment });
    }

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
};

export const updateComment = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId, commentId } = req.params;
    const { content } = req.body;

    const comment = await TaskComment.findOneAndUpdate(
      {
        _id: commentId,
        taskId,
        projectId,
        organizationId: req.user?.organizationId,
        authorId: req.user?.id, // Only author can edit
      },
      { content },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({ message: 'Comment not found or unauthorized' });
      return;
    }

    res.json({ comment });
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId, taskId, commentId } = req.params;

    const comment = await TaskComment.findOneAndDelete({
      _id: commentId,
      taskId,
      projectId,
      organizationId: req.user?.organizationId,
      authorId: req.user?.id, // Only author can delete
    });

    if (!comment) {
      res.status(404).json({ message: 'Comment not found or unauthorized' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
