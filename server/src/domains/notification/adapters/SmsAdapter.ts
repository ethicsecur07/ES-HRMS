export class SmsAdapter {
  async send(notification: any): Promise<void> {
    // TODO: integrate real SMS provider (e.g., Twilio)
    console.log('Sending SMS notification', notification._id);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
