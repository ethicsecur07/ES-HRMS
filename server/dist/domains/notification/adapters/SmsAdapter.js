"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsAdapter = void 0;
class SmsAdapter {
    async send(notification) {
        // TODO: integrate real SMS provider (e.g., Twilio)
        console.log('Sending SMS notification', notification._id);
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
exports.SmsAdapter = SmsAdapter;
