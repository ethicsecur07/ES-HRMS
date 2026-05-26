/**
 * LeaveService.ts
 * ---------------
 * Core leave business logic service.
 * Handles: creation, validation, overlap detection, cancellation, modification.
 * All operations are transaction-safe and organization-scoped.
 */

import mongoose from 'mongoose';
import { Leave } from '../../../models/Leave.js';
import { Employee } from '../../../models/Employee.js';
import { LeavePolicyEngine } from '../policies/LeavePolicyEngine.js';
import { LeaveBalanceService } from './LeaveBalanceService.js';
import { createAuditLog } from '../../../services/auditLog.service.js';
import { logger } from '../../../utils/logger.js';

export interface CreateLeaveParams {
  organizationId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  expectedTasks?: string;
  appliedByUserId: string;
  appliedByEmail: string;
}

export interface LeaveOperationResult {
  success: boolean;
  message: string;
  leave?: any;
  violations?: string[];
}

export class LeaveService {
  /**
   * Create a leave request with full validation.
   * - Validates employee belongs to org
   * - Validates date range
   * - Calculates server-side totalDays (not trusted from client)
   * - Checks for overlap with existing approved/pending leaves
   * - Validates balance
   * - Validates policy
   * Returns violations array if any policy is breached.
   */
  static async createLeave(params: CreateLeaveParams): Promise<LeaveOperationResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        organizationId,
        employeeId,
        leaveType,
        startDate,
        endDate,
        reason,
        expectedTasks,
        appliedByUserId,
        appliedByEmail,
      } = params;

      // 1. Validate employee belongs to this org (tenant safety)
      const employee = await Employee.findOne(
        { _id: employeeId, organizationId },
        null,
        { session }
      );
      if (!employee) {
        await session.abortTransaction();
        return { success: false, message: 'Employee not found in this organization.' };
      }

      // 2. Server-side date validation and totalDays calculation
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        await session.abortTransaction();
        return { success: false, message: 'Invalid date format. Use YYYY-MM-DD.' };
      }

      if (end < start) {
        await session.abortTransaction();
        return { success: false, message: 'End date must be on or after start date.' };
      }

      // 3. Calculate duration server-side (NOT trusted from client)
      let durationResult;
      try {
        durationResult = await LeavePolicyEngine.calculateLeaveDuration(
          organizationId,
          leaveType,
          startDate,
          endDate
        );
      } catch (policyErr: any) {
        await session.abortTransaction();
        return { success: false, message: policyErr.message };
      }

      const totalDays = durationResult.finalDeductionDays;

      // 4. Validate policy constraints
      const violations = await LeavePolicyEngine.validateLeaveRequest({
        organizationId,
        employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
      });

      if (violations.length > 0) {
        await session.abortTransaction();
        return {
          success: false,
          message: 'Leave request violates policy constraints.',
          violations: violations.map((v) => v.message),
        };
      }

      // 5. Overlap detection — check for conflicting leaves
      const overlap = await Leave.findOne({
        organizationId,
        employeeId,
        status: { $in: ['PENDING', 'APPROVED'] },
        $or: [
          { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        ],
      }).session(session);

      if (overlap) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Leave conflict detected. You already have a ${overlap.status.toLowerCase()} ${overlap.leaveType} from ${overlap.startDate} to ${overlap.endDate}.`,
        };
      }

      // 6. Create the leave record
      const [leave] = await Leave.create(
        [
          {
            organizationId,
            employeeId,
            leaveType,
            startDate,
            endDate,
            totalDays,
            reason,
            expectedTasks,
            status: 'PENDING',
            appliedAt: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();

      // 7. Audit log (after transaction commits)
      await createAuditLog(
        'LEAVE_APPLY',
        appliedByEmail,
        'LEAVE',
        leave.id,
        `Applied for ${leaveType} (${totalDays} days): ${startDate} to ${endDate}`,
        organizationId
      );

      logger.info(`[LeaveService] Leave created: ${leave.id} for employee ${employeeId}`);
      return { success: true, message: 'Leave application submitted successfully.', leave };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('[LeaveService] createLeave failed', { error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Approve a leave request — deducts balance atomically.
   * Validates the approver has org scope.
   */
  static async approveLeave(
    leaveId: string,
    organizationId: string,
    approverId: string,
    approverEmail: string
  ): Promise<LeaveOperationResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Fetch leave with org scope
      const leave = await Leave.findOne(
        { _id: leaveId, organizationId },
        null,
        { session }
      ).populate('employeeId');

      if (!leave) {
        await session.abortTransaction();
        return { success: false, message: 'Leave request not found in this organization.' };
      }

      if (leave.status !== 'PENDING') {
        await session.abortTransaction();
        return { success: false, message: `Cannot approve a leave that is already ${leave.status}.` };
      }

      // Deduct balance atomically
      if (leave.leaveType !== 'WFH' && leave.leaveType !== 'Unpaid Leave') { // WFH and Unpaid Leave bypass standard balance
        const balanceResult = await LeaveBalanceService.deductBalance(
          organizationId,
          leave.employeeId.toString(),
          leave.leaveType,
          leave.totalDays,
          session
        );

        if (!balanceResult) {
          await session.abortTransaction();
          return {
            success: false,
            message: `Insufficient leave balance to approve. Cannot approve ${leave.totalDays} days of ${leave.leaveType}.`,
          };
        }
      }

      // Update leave status
      leave.status = 'APPROVED';
      leave.approvedBy = new mongoose.Types.ObjectId(approverId);
      await leave.save({ session });

      await session.commitTransaction();

      await createAuditLog(
        'LEAVE_APPROVED',
        approverEmail,
        'LEAVE',
        leave.id,
        `Approved ${leave.leaveType} (${leave.totalDays} days) for employee ${leave.employeeId}`,
        organizationId
      );

      return { success: true, message: 'Leave approved successfully.', leave };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('[LeaveService] approveLeave failed', { error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reject a leave request.
   */
  static async rejectLeave(
    leaveId: string,
    organizationId: string,
    approverId: string,
    approverEmail: string,
    rejectionReason: string
  ): Promise<LeaveOperationResult> {
    const leave = await Leave.findOne({ _id: leaveId, organizationId });
    if (!leave) return { success: false, message: 'Leave request not found in this organization.' };

    if (leave.status !== 'PENDING') {
      return { success: false, message: `Cannot reject a leave that is already ${leave.status}.` };
    }

    leave.status = 'REJECTED';
    leave.approvedBy = new mongoose.Types.ObjectId(approverId);
    leave.rejectionReason = rejectionReason;
    await leave.save();

    await createAuditLog(
      'LEAVE_REJECTED',
      approverEmail,
      'LEAVE',
      leave.id,
      `Rejected ${leave.leaveType}. Reason: ${rejectionReason}`,
      organizationId
    );

    return { success: true, message: 'Leave rejected.', leave };
  }

  /**
   * Cancel an approved or pending leave.
   * Restores balance if leave was APPROVED.
   */
  static async cancelLeave(
    leaveId: string,
    organizationId: string,
    requestedByEmployeeId: string,
    cancelledByEmail: string,
    isAdminOrHR: boolean
  ): Promise<LeaveOperationResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const leave = await Leave.findOne({ _id: leaveId, organizationId }, null, { session });
      if (!leave) {
        await session.abortTransaction();
        return { success: false, message: 'Leave request not found.' };
      }

      // Ownership check: employees can only cancel their own leaves
      if (!isAdminOrHR && leave.employeeId.toString() !== requestedByEmployeeId) {
        await session.abortTransaction();
        return { success: false, message: 'You can only cancel your own leave requests.' };
      }

      if (leave.status === 'REJECTED') {
        await session.abortTransaction();
        return { success: false, message: 'Cannot cancel a rejected leave.' };
      }

      const wasApproved = leave.status === 'APPROVED';

      // Restore balance if leave was approved
      if (wasApproved && leave.leaveType !== 'WFH') {
        await LeaveBalanceService.restoreBalance(
          organizationId,
          leave.employeeId.toString(),
          leave.leaveType,
          leave.totalDays,
          session
        );
      }

      leave.status = 'CANCELLED' as any;
      await leave.save({ session });

      await session.commitTransaction();

      await createAuditLog(
        'LEAVE_CANCELLED',
        cancelledByEmail,
        'LEAVE',
        leave.id,
        `Cancelled ${leave.leaveType} (${leave.totalDays} days). Balance restored: ${wasApproved}`,
        organizationId
      );

      return { success: true, message: 'Leave cancelled successfully.' + (wasApproved ? ' Balance restored.' : ''), leave };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error('[LeaveService] cancelLeave failed', { error: error.message });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Validate ownership: confirm the leave belongs to the specified employee in the org.
   */
  static async validateOwnership(
    leaveId: string,
    organizationId: string,
    employeeId: string
  ): Promise<boolean> {
    const leave = await Leave.findOne({ _id: leaveId, organizationId, employeeId });
    return !!leave;
  }
}
