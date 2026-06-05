"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationWorker = exports.notificationQueue = void 0;
const bullmq_1 = require("bullmq");
const Notification_js_1 = require("../../models/Notification.js");
const NotificationService_js_1 = require("./NotificationService.js");
// Queue name
exports.notificationQueue = new bullmq_1.Queue('notificationQueue', {
    connection: { host: '127.0.0.1', port: 6379 }, // adjust as needed
});
// Worker to process jobs
exports.notificationWorker = new bullmq_1.Worker('notificationQueue', async (job) => {
    const { notificationId } = job.data;
    const notification = await Notification_js_1.Notification.findById(notificationId);
    if (!notification)
        throw new Error('Notification not found');
    const service = new NotificationService_js_1.NotificationService();
    await service.dispatch(notification);
}, {
    connection: { host: '127.0.0.1', port: 6379 },
});
exports.notificationQueue.on('error', (err) => {
    console.warn('BullMQ Notification Queue error (Redis down):', err.message);
});
exports.notificationWorker.on('error', (err) => {
    console.warn('BullMQ Notification Worker error (Redis down):', err.message);
});
exports.notificationWorker.on('failed', (job, err) => {
    console.error(`Notification job ${job?.id} failed:`, err);
});
exports.default = exports.notificationQueue;
