import { Queue, Worker, Job } from 'bullmq';
import { Notification } from '../../models/Notification.js';
import { NotificationService } from './NotificationService.js';

// Queue name
export const notificationQueue = new Queue('notificationQueue', {
  connection: { host: '127.0.0.1', port: 6379 }, // adjust as needed
});

// Worker to process jobs
export const notificationWorker = new Worker('notificationQueue', async (job: Job) => {
  const { notificationId } = job.data;
  const notification = await Notification.findById(notificationId);
  if (!notification) throw new Error('Notification not found');
  const service = new NotificationService();
  await service.dispatch(notification);
}, {
  connection: { host: '127.0.0.1', port: 6379 },
});

notificationWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`Notification job ${job?.id} failed:`, err);
});

export default notificationQueue;
