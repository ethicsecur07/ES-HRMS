"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllAsRead = exports.markAsRead = exports.getUserNotifications = void 0;
const Notification_js_1 = require("../../models/Notification.js");
const getUserNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await Notification_js_1.Notification.find({ recipientId: userId })
            .sort({ createdAt: -1 })
            .limit(50);
        res.status(200).json({ success: true, notifications });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getUserNotifications = getUserNotifications;
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification_js_1.Notification.findByIdAndUpdate(id, { read: true }, { new: true });
        res.status(200).json({ success: true, notification });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.markAsRead = markAsRead;
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        await Notification_js_1.Notification.updateMany({ recipientId: userId, read: false }, { read: true });
        res.status(200).json({ success: true, message: 'All marked as read' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markAllAsRead = markAllAsRead;
