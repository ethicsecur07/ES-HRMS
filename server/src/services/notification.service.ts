import { Notification, INotification } from '../models/Notification.js';
import { getIO } from '../sockets/socketHandler.js';
import { logger } from '../utils/logger.js';
import mongoose from 'mongoose';

type Channel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';

interface NotificationPayload {
  organizationId: mongoose.Types.ObjectId;
  recipientId: string;
  title: string;
  message: string;
  channels: Channel[];
  type: string;
  payload?: Record<string, any>;
}

export const notificationService = {
  dispatchNotification: async (data: NotificationPayload) => {
    logger.info(`Dispatching ${data.type} notification to ${data.recipientId} via channels: ${data.channels.join(', ')}`);

    for (const channel of data.channels) {
      try {
        // Save record in DB
        const notification = new Notification({
          organizationId: data.organizationId,
          recipientId: data.recipientId,
          title: data.title,
          message: data.message,
          channel: channel,
          type: data.type,
          payload: data.payload,
          status: 'PENDING'
        });

        await notification.save();

        switch (channel) {
          case 'IN_APP':
            await notificationService.sendInApp(notification);
            break;
          case 'EMAIL':
            await notificationService.sendEmail(notification);
            break;
          case 'SMS':
            await notificationService.sendSMS(notification);
            break;
          case 'PUSH':
            await notificationService.sendPush(notification);
            break;
          case 'WHATSAPP':
            // Ignored for now
            break;
        }
      } catch (err) {
        logger.error(`Failed to dispatch notification to channel ${channel}:`, err);
      }
    }
  },

  sendInApp: async (notification: INotification) => {
    // Broadcast via socket to user's room
    const io = getIO();
    if (io) {
      io.to(`user_${notification.recipientId}`).emit('new_notification', notification);

      // Update status
      notification.status = 'SENT';
      await notification.save();
      logger.info(`IN_APP notification sent to user_${notification.recipientId}`);
    } else {
      logger.warn('Socket.io not initialized, could not send IN_APP notification');
    }
  },

  sendEmail: async (notification: INotification) => {
    // MOCK: Integration with Nodemailer/SendGrid
    logger.info(`[MOCK EMAIL] Sending email to User ${notification.recipientId}: ${notification.title}`);
    notification.status = 'SENT';
    await notification.save();
  },

  sendSMS: async (notification: INotification) => {
    // MOCK: Integration with Twilio
    logger.info(`[MOCK SMS] Sending SMS to User ${notification.recipientId}: ${notification.title}`);
    notification.status = 'SENT';
    await notification.save();
  },

  sendPush: async (notification: INotification) => {
    // MOCK: Integration with WebPush/Firebase
    logger.info(`[MOCK PUSH] Sending WebPush to User ${notification.recipientId}: ${notification.title}`);
    notification.status = 'SENT';
    await notification.save();
  }
};
