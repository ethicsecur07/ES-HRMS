"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const Notification_1 = require("../../models/Notification");
const notificationQueue_1 = require("./notificationQueue");
const EmailAdapter_1 = require("./adapters/EmailAdapter");
const SmsAdapter_1 = require("./adapters/SmsAdapter");
const PushAdapter_1 = require("./adapters/PushAdapter");
const WhatsAppAdapter_1 = require("./adapters/WhatsAppAdapter");
class NotificationService {
    adapters = {};
    constructor() {
        this.adapters['EMAIL'] = new EmailAdapter_1.EmailAdapter();
        this.adapters['SMS'] = new SmsAdapter_1.SmsAdapter();
        this.adapters['PUSH'] = new PushAdapter_1.PushAdapter();
        this.adapters['WHATSAPP'] = new WhatsAppAdapter_1.WhatsAppAdapter();
        // IN_APP will be handled directly, no external provider
    }
    /**
     * Queue a notification for async processing.
     */
    async send(notificationData) {
        const notification = await Notification_1.Notification.create(notificationData);
        await notificationQueue_1.notificationQueue.add('dispatch', { notificationId: notification._id });
        return notification;
    }
    /**
     * Called by the worker to actually deliver the notification.
     */
    async dispatch(notification) {
        // Update status to PENDING if not already
        if (notification.status !== 'PENDING') {
            notification.status = 'PENDING';
            await notification.save();
        }
        if (notification.channel === 'IN_APP') {
            // In-app notifications are considered sent once persisted
            notification.status = 'SENT';
            await notification.save();
            return;
        }
        const adapter = this.adapters[notification.channel];
        if (!adapter) {
            throw new Error(`No adapter configured for channel ${notification.channel}`);
        }
        try {
            await adapter.send(notification);
            notification.status = 'SENT';
        }
        catch (err) {
            notification.status = 'FAILED';
            notification.errorMessage = err.message;
        }
        await notification.save();
    }
}
exports.NotificationService = NotificationService;
