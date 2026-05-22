"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailAdapter = void 0;
class EmailAdapter {
    async send(notification) {
        // TODO: integrate real email provider (e.g., SendGrid, SES)
        console.log('Sending EMAIL notification', notification._id);
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
exports.EmailAdapter = EmailAdapter;
