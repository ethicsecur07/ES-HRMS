import cron from 'node-cron';
import { Attendance } from '../models/Attendance.js';
import { Employee } from '../models/Employee.js';
import { logger } from '../utils/logger.js';

export const initCronJobs = () => {
  // Auto-checkout active attendances at midnight if employee forgot
  cron.schedule('0 0 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const unclosed = await Attendance.find({ date: dateStr, logoutTime: { $exists: false } });
      for (const att of unclosed) {
        att.logoutTime = new Date(`${dateStr}T20:00:00.000Z`); // Auto close at 8 PM
        att.workingHours = 9;
        await att.save();
      }

      logger.info(`Cron: Auto-checked out ${unclosed.length} attendance records for ${dateStr}`);
    } catch (error) {
      logger.error('Cron auto-checkout failed', { error });
    }
  });

  // Monthly leave balance reset on 1st of every month
  cron.schedule('0 0 1 * *', async () => {
    try {
      await Employee.updateMany({ isActive: true }, { leaveBalance: 2, wfhBalance: 1, permissionHoursBalance: 3 });
      logger.info('Cron: Monthly leave, WFH, and permission balances reset successfully');
    } catch (error) {
      logger.error('Cron monthly reset failed', { error });
    }
  });
};
