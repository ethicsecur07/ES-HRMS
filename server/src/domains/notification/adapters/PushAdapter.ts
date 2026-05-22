export class PushAdapter {
  async send(notification: any): Promise<void> {
    // TODO: integrate real push notification provider (e.g., Firebase Cloud Messaging)
    console.log('Sending PUSH notification', notification._id);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
