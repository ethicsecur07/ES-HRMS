"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppAdapter = void 0;
class WhatsAppAdapter {
    async send(notification) {
        // TODO: integrate real WhatsApp provider (e.g., Twilio API)
        console.log('Sending WHATSAPP notification', notification._id);
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
exports.WhatsAppAdapter = WhatsAppAdapter;
