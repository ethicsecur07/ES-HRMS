import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { TaskActivity } from '../../models/TaskActivity.js';

export const getTaskActivity = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId, projectId } = req.params;
    const activities = await TaskActivity.find({
      taskId,
      projectId,
      organizationId: req.user?.organizationId,
    }).sort({ createdAt: -1 });

    res.json({ activities });
  } catch (err) {
    next(err);
  }
};

export const getProjectActivity = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const activities = await TaskActivity.find({
      projectId,
      organizationId: req.user?.organizationId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await TaskActivity.countDocuments({
      projectId,
      organizationId: req.user?.organizationId,
    });

    res.json({
      activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
