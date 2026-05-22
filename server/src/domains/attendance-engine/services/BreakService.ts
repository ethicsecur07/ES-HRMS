import mongoose from 'mongoose';
import { Attendance, IAttendance } from '../../../models/Attendance.js';

export class BreakService {
  /**
   * Starts a new break log for an employee's daily attendance record.
   * Prevents starting a break if they are not checked in or already on an active break.
   */
  static async startBreak(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    dateString: string,
    breakType: 'LUNCH' | 'TEA' | 'PERSONAL' = 'LUNCH'
  ): Promise<IAttendance> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId.toString());

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch attendance record
      const attendance = await Attendance.findOne({
        employeeId: empId,
        organizationId: orgId,
        date: dateString,
      }).session(session);

      if (!attendance) {
        throw new Error('Employee must be checked in before starting a break.');
      }

      // 2. Prevent concurrent breaks
      const activeBreak = attendance.breaks.find(b => !b.breakEnd);
      if (activeBreak) {
        throw new Error('Employee is already on an active break. Please end the current break first.');
      }

      // 3. Push new break
      attendance.breaks.push({
        breakStart: new Date(),
        type: breakType,
      });

      await attendance.save({ session });
      await session.commitTransaction();
      return attendance;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Ends the currently active break log.
   * Calculates the break duration in minutes and raises anomaly alerts if break time limits are breached.
   */
  static async endBreak(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    dateString: string
  ): Promise<IAttendance> {
    const orgId = new mongoose.Types.ObjectId(organizationId.toString());
    const empId = new mongoose.Types.ObjectId(employeeId.toString());

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const attendance = await Attendance.findOne({
        employeeId: empId,
        organizationId: orgId,
        date: dateString,
      }).session(session);

      if (!attendance) {
        throw new Error('Attendance record not found.');
      }

      const activeBreakIndex = attendance.breaks.findIndex(b => !b.breakEnd);
      if (activeBreakIndex === -1) {
        throw new Error('No active break found to end.');
      }

      const now = new Date();
      const breakStart = attendance.breaks[activeBreakIndex].breakStart;
      const durationMs = now.getTime() - breakStart.getTime();
      const durationMinutes = parseFloat((durationMs / (1000 * 60)).toFixed(1));

      attendance.breaks[activeBreakIndex].breakEnd = now;
      attendance.breaks[activeBreakIndex].durationMinutes = durationMinutes;

      // Calculate total break duration in minutes for anomaly evaluation
      const totalMinutes = attendance.breaks.reduce((acc, curr) => {
        return acc + (curr.durationMinutes || 0);
      }, 0);

      // Flag break excess anomaly if total breaks exceed 60 minutes
      if (totalMinutes > 60) {
        attendance.anomaly = {
          isAnomaly: true,
          anomalyType: 'BREAK_EXCESS',
          description: `Total break time exceeded the allowed limit. Total: ${totalMinutes} minutes.`,
          isResolved: false,
        };
      }

      await attendance.save({ session });
      await session.commitTransaction();
      return attendance;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}
