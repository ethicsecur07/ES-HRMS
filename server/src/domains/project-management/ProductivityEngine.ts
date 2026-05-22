import { TimeLog } from '../../models/project-management/TimeLog.js';
import { Task } from '../../models/Task.js';
import { Types } from 'mongoose';

export class ProductivityEngine {
  /**
   * Evaluates employee utilization over a date range.
   * Utilization = (Logged Hours) / (Standard Capacity)
   */
  public static async calculateUtilization(employeeId: Types.ObjectId, startDate: string, endDate: string): Promise<any> {
    const logs = await TimeLog.find({
      employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    const totalLogged = logs.reduce((sum, log) => sum + log.hoursLogged, 0);
    const billableLogged = logs.filter(l => l.isBillable).reduce((sum, log) => sum + log.hoursLogged, 0);
    
    // Assume 8 hours/day for 5 days a week = ~40 hours/week.
    // Calculate weekdays between dates
    let capacity = 0;
    const curr = new Date(startDate);
    const end = new Date(endDate);
    while (curr <= end) {
      if (curr.getDay() !== 0 && curr.getDay() !== 6) capacity += 8;
      curr.setDate(curr.getDate() + 1);
    }

    const utilizationPercentage = capacity > 0 ? (totalLogged / capacity) * 100 : 0;
    
    return {
      totalLogged,
      billableLogged,
      capacity,
      utilizationPercentage: Math.round(utilizationPercentage),
      isBurnoutRisk: utilizationPercentage > 120
    };
  }

  /**
   * Generates a productivity score based on task estimates vs actuals
   */
  public static async calculateProductivityScore(employeeId: Types.ObjectId): Promise<number> {
    const tasks = await Task.find({ assignedTo: employeeId, status: 'DONE' });
    if (tasks.length === 0) return 100; // Baseline

    let score = 100;
    
    for (const task of tasks) {
      // Simplistic scoring: if actual hours > (story points * 3), deduct points
      const expectedHours = (task.storyPoints || 0) * 3; 
      if (task.actualHours && expectedHours > 0) {
        if (task.actualHours > expectedHours * 1.5) {
          score -= 5;
        } else if (task.actualHours < expectedHours) {
          score += 2; // Bonus for efficiency
        }
      }
    }
    
    return Math.max(0, Math.min(100, score)); // clamp 0-100
  }
}
