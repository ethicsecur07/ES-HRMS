/**
 * cronJobs.ts (REFACTORED)
 * -------------------------
 * Fixes:
 *   - Monthly balance reset now org-scoped (not global Employee.updateMany)
 *   - Uses LeaveAccrualService for idempotent, bulk accrual
 *   - Uses policy values from DB (not hardcoded constants)
 *   - Carry-forward applied during monthly reset
 *   - Year-end carry-forward processing
 *   - Auto-checkout remains, enhanced with org awareness
 */

import cron from 'node-cron';
import { Attendance } from '../models/Attendance.js';
import { Organization } from '../models/Organization.js';
import { logger } from '../utils/logger.js';
import { LeaveAccrualService } from '../domains/leave-engine/services/LeaveAccrualService.js';
import { calculateMonthlyPayroll } from '../services/payroll.service.js';

export const initCronJobs = () => {
  // ─────────────────────────────────────────────────────────────
  // Auto-checkout at midnight: close any open attendance records
  // ─────────────────────────────────────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const unclosed = await Attendance.find({
        date: dateStr,
        logoutTime: { $exists: false },
      });

      for (const att of unclosed) {
        const loginTime = new Date(att.loginTime);
        const logoutTime = new Date(loginTime);
        logoutTime.setHours(18, 0, 0, 0); // 6:00 PM local time
        
        let workingHours = parseFloat(((logoutTime.getTime() - loginTime.getTime()) / (1000 * 60 * 60)).toFixed(2));
        if (workingHours <= 0) {
          logoutTime.setTime(loginTime.getTime() + 9 * 60 * 60 * 1000);
          workingHours = 9;
        }

        att.logoutTime = logoutTime;
        att.workingHours = workingHours;
        att.isAutoCheckedOut = true;
        att.pendingReportUpdate = true;
        await att.save();
      }

      logger.info(`[CRON] Auto-checkout: ${unclosed.length} attendance records closed for ${dateStr}`);
    } catch (error) {
      logger.error('[CRON] Auto-checkout failed', { error });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Monthly leave balance reset — 1st of every month at 00:05
  // Org-scoped, policy-driven, with carry-forward support
  // ─────────────────────────────────────────────────────────────
  cron.schedule('5 0 1 * *', async () => {
    try {
      const orgs = await Organization.find({ isActive: true }, { _id: 1 });
      logger.info(`[CRON] Starting monthly leave reset for ${orgs.length} organizations`);

      let totalReset = 0;
      for (const org of orgs) {
        try {
          const result = await LeaveAccrualService.runMonthlyReset(org._id.toString());
          totalReset += result.resetCount;
          logger.info(`[CRON] Reset org ${org._id}: ${result.resetCount} balances`);
        } catch (orgErr: any) {
          logger.error(`[CRON] Monthly reset failed for org ${org._id}`, { error: orgErr.message });
        }
      }

      logger.info(`[CRON] Monthly leave reset complete. Total balances reset: ${totalReset}`);
    } catch (error) {
      logger.error('[CRON] Monthly leave reset failed', { error });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Monthly accrual — runs on 1st of month at 00:10
  // Idempotent: will skip if already ran for this period
  // ─────────────────────────────────────────────────────────────
  cron.schedule('10 0 1 * *', async () => {
    try {
      logger.info('[CRON] Starting monthly leave accrual for all organizations');
      const results = await LeaveAccrualService.runGlobalMonthlyAccrual();
      
      const totalUpdates = results.reduce((sum, r) => sum + r.balancesUpdated, 0);
      const totalSkipped = results.reduce((sum, r) => sum + r.skippedDuplicates, 0);
      const totalErrors = results.filter(r => r.errors.length > 0).length;

      logger.info(`[CRON] Accrual complete: orgs=${results.length}, balances=${totalUpdates}, skipped=${totalSkipped}, errors=${totalErrors}`);
    } catch (error) {
      logger.error('[CRON] Global accrual failed', { error });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Year-end carry-forward — Dec 31st at 23:00
  // Applies carry-forward caps from policy and resets remaining
  // ─────────────────────────────────────────────────────────────
  cron.schedule('0 23 31 12 *', async () => {
    try {
      const orgs = await Organization.find({ isActive: true }, { _id: 1 });
      logger.info(`[CRON] Year-end carry-forward for ${orgs.length} organizations`);

      for (const org of orgs) {
        try {
          const result = await LeaveAccrualService.applyYearEndCarryForward(org._id.toString());
          logger.info(`[CRON] Year-end carry-forward org ${org._id}: ${result.processedCount} balances processed`);
        } catch (orgErr: any) {
          logger.error(`[CRON] Year-end carry-forward failed for org ${org._id}`, { error: orgErr.message });
        }
      }
    } catch (error) {
      logger.error('[CRON] Year-end carry-forward failed', { error });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // Monthly payroll generation — runs on 1st of month at 01:00
  // ─────────────────────────────────────────────────────────────
  cron.schedule('0 1 1 * *', async () => {
    try {
      logger.info('[CRON] Starting automated monthly payroll generation');
      // Get previous month string in YYYY-MM format
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      const year = date.getFullYear();
      const monthStr = String(date.getMonth() + 1).padStart(2, '0');
      const month = `${year}-${monthStr}`;

      const orgs = await Organization.find({ isActive: true });
      for (const org of orgs) {
        try {
          await calculateMonthlyPayroll(month, org._id.toString());
          logger.info(`[CRON] Payroll generated for org: ${org.name} (${month})`);
        } catch (orgError) {
          logger.error(`[CRON] Failed to generate payroll for org: ${org.name}`, { error: orgError });
        }
      }
    } catch (error) {
      logger.error('[CRON] Error during automated payroll generation', { error });
    }
  });
};
