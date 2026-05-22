"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushAdapter = void 0;
class PushAdapter {
    async send(notification) {
        // TODO: integrate real push notification provider (e.g., Firebase Cloud Messaging)
        console.log('Sending PUSH notification', notification._id);
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
}
exports.PushAdapter = PushAdapter;
