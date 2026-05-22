export class EmailAdapter {
  async send(notification: any) {
    // TODO: integrate real email provider (e.g., SendGrid, SES)
    console.log('Sending EMAIL notification', notification._id);
    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
