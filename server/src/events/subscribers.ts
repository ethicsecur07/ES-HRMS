import { eventBus } from './EventBus.js';
import { getIO } from '../sockets/socketHandler.js';
import { Payroll } from '../models/Payroll.js';
import { User } from '../models/User.js';
import { createAuditLog } from '../services/auditLog.service.js';

export const registerSubscribers = () => {
  // Listen for leave.approved events
  eventBus.subscribe('leave.approved', async (payload: {
    leaveId: string;
    organizationId: string;
    employeeId: string;
    employeeName: string;
    totalDays: number;
    month: string; // YYYY-MM
    approvedBy: string;
  }) => {
    try {
      console.log(`[EVENT HANDLER] Processing 'leave.approved' async tasks for leave ${payload.leaveId}`);

      // 1. Emit Real-Time Socket Event
      const io = getIO();
      if (io) {
        // Emit to the specific employee or general update
        const empUser = await User.findOne({ employeeId: payload.employeeId, organizationId: payload.organizationId });
        if (empUser) {
          io.to(`user_${empUser._id}`).emit('receive_notification', {
            _id: `leave-approved-${payload.leaveId}`,
            title: 'Leave Approved',
            message: `Your leave request for ${payload.totalDays} day(s) has been approved.`,
            type: 'LEAVE',
            recipientId: empUser._id.toString()
          });
          console.log(`[EVENT HANDLER] Emitted socket notification to employee user_${empUser._id}`);
        }
      }

      // 2. Create Audit Trail Log
      await createAuditLog(
        'LEAVE_APPROVED_EVENT',
        payload.approvedBy,
        'LEAVES',
        payload.leaveId,
        `Leave approved for ${payload.employeeName} (${payload.totalDays} days).`,
        payload.organizationId
      );
      console.log(`[EVENT HANDLER] Audit log created successfully.`);

    } catch (err) {
      console.error("[EVENT HANDLER ERROR] failed processing leave.approved:", err);
    }
  });

  console.log('🔔 Domain Event Bus subscribers registered successfully.');
};
