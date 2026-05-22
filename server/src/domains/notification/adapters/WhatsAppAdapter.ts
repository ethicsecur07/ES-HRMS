export class WhatsAppAdapter {
  async send(notification: any): Promise<void> {
    // TODO: integrate real WhatsApp provider (e.g., Twilio API)
    console.log('Sending WHATSAPP notification', notification._id);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
