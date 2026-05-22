import { Notification, INotification } from '../../models/Notification';
import { notificationQueue } from './notificationQueue';
import { EmailAdapter } from './adapters/EmailAdapter';
import { SmsAdapter } from './adapters/SmsAdapter';
import { PushAdapter } from './adapters/PushAdapter';
import { WhatsAppAdapter } from './adapters/WhatsAppAdapter';

export class NotificationService {
  private adapters: Record<string, any> = {};

  constructor() {
    this.adapters['EMAIL'] = new EmailAdapter();
    this.adapters['SMS'] = new SmsAdapter();
    this.adapters['PUSH'] = new PushAdapter();
    this.adapters['WHATSAPP'] = new WhatsAppAdapter();
    // IN_APP will be handled directly, no external provider
  }

  /**
   * Queue a notification for async processing.
   */
  async send(notificationData: Partial<INotification>) {
    const notification = await Notification.create(notificationData);
    await notificationQueue.add('dispatch', { notificationId: notification._id });
    return notification;
  }

  /**
   * Called by the worker to actually deliver the notification.
   */
  async dispatch(notification: any) {
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
    } catch (err: any) {
      notification.status = 'FAILED';
      notification.errorMessage = err.message;
    }
    await notification.save();
  }
}
