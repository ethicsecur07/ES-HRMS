"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const Notification_js_1 = require("../models/Notification.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const logger_js_1 = require("../utils/logger.js");
exports.notificationService = {
    dispatchNotification: async (data) => {
        logger_js_1.logger.info(`Dispatching ${data.type} notification to ${data.recipientId} via channels: ${data.channels.join(', ')}`);
        for (const channel of data.channels) {
            try {
                // Save record in DB
                const notification = new Notification_js_1.Notification({
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
                        await exports.notificationService.sendInApp(notification);
                        break;
                    case 'EMAIL':
                        await exports.notificationService.sendEmail(notification);
                        break;
                    case 'SMS':
                        await exports.notificationService.sendSMS(notification);
                        break;
                    case 'PUSH':
                        await exports.notificationService.sendPush(notification);
                        break;
                    case 'WHATSAPP':
                        // Ignored for now
                        break;
                }
            }
            catch (err) {
                logger_js_1.logger.error(`Failed to dispatch notification to channel ${channel}:`, err);
            }
        }
    },
    sendInApp: async (notification) => {
        // Broadcast via socket to user's room
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`user_${notification.recipientId}`).emit('new_notification', notification);
            // Update status
            notification.status = 'SENT';
            await notification.save();
            logger_js_1.logger.info(`IN_APP notification sent to user_${notification.recipientId}`);
        }
        else {
            logger_js_1.logger.warn('Socket.io not initialized, could not send IN_APP notification');
        }
    },
    sendEmail: async (notification) => {
        // MOCK: Integration with Nodemailer/SendGrid
        logger_js_1.logger.info(`[MOCK EMAIL] Sending email to User ${notification.recipientId}: ${notification.title}`);
        notification.status = 'SENT';
        await notification.save();
    },
    sendSMS: async (notification) => {
        // MOCK: Integration with Twilio
        logger_js_1.logger.info(`[MOCK SMS] Sending SMS to User ${notification.recipientId}: ${notification.title}`);
        notification.status = 'SENT';
        await notification.save();
    },
    sendPush: async (notification) => {
        // MOCK: Integration with WebPush/Firebase
        logger_js_1.logger.info(`[MOCK PUSH] Sending WebPush to User ${notification.recipientId}: ${notification.title}`);
        notification.status = 'SENT';
        await notification.save();
    }
};
