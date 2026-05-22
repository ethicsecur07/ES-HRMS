import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { AgileEngine } from './AgileEngine.js';
import { ProductivityEngine } from './ProductivityEngine.js';
import { TimesheetService } from './TimesheetService.js';
import mongoose from 'mongoose';

export const getSprintBurndown = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sprintId } = req.params;
    const data = await AgileEngine.calculateSprintBurndown(new mongoose.Types.ObjectId(sprintId));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getTeamVelocity = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const velocity = await AgileEngine.calculateTeamVelocity(new mongoose.Types.ObjectId(projectId));
    res.json({ projectId, averageVelocity: velocity });
  } catch (err) {
    next(err);
  }
};

export const getEmployeeProductivity = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query as { startDate: string, endDate: string };
    
    if (!startDate || !endDate) {
      res.status(400).json({ message: 'startDate and endDate are required query params' });
      return;
    }

    const objectId = new mongoose.Types.ObjectId(employeeId);
    
    const [utilization, score] = await Promise.all([
      ProductivityEngine.calculateUtilization(objectId, startDate, endDate),
      ProductivityEngine.calculateProductivityScore(objectId)
    ]);

    res.json({
      employeeId,
      utilization,
      productivityScore: score
    });
  } catch (err) {
    next(err);
  }
};

export const exportProjectInvoice = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { yearMonth } = req.body; // e.g. "2023-10"

    const data = await TimesheetService.generateInvoicePayload(new mongoose.Types.ObjectId(projectId), yearMonth);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
