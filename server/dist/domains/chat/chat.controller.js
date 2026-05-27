"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = exports.getConversation = void 0;
const Message_js_1 = require("../../models/Message.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;
        let query;
        if (otherUserId === 'broadcast' || otherUserId.startsWith('group_')) {
            // For broadcast and group chats, messages are queried by their channel identifier
            query = { receiverId: otherUserId };
        }
        else {
            // 1:1 chat query
            query = {
                $or: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            };
        }
        const messages = await Message_js_1.Message.find(query).sort({ createdAt: 1 });
        // Mark received messages as read (only relevant for 1:1 chats)
        if (otherUserId !== 'broadcast' && !otherUserId.startsWith('group_')) {
            await Message_js_1.Message.updateMany({ senderId: otherUserId, receiverId: userId, read: false }, { read: true });
        }
        res.status(200).json({ data: { messages } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getConversation = getConversation;
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId, content } = req.body;
        const message = new Message_js_1.Message({
            senderId,
            receiverId,
            content
        });
        await message.save();
        // Emit via socket directly for chat
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            if (receiverId === 'broadcast') {
                io.to(`org_${req.user.organizationId}`).emit('receive_message', message);
            }
            else if (receiverId.startsWith('group_')) {
                io.to(receiverId).emit('receive_message', message);
            }
            else {
                io.to(`user_${receiverId}`).emit('receive_message', message);
            }
        }
        // Only dispatch notification for 1:1 messages to avoid broadcast spam
        if (receiverId !== 'broadcast' && !receiverId.startsWith('group_')) {
            await notification_service_js_1.notificationService.dispatchNotification({
                organizationId: req.user.organizationId,
                recipientId: receiverId,
                title: 'New Message',
                message: `You have a new message.`,
                channels: ['IN_APP'],
                type: 'CHAT'
            });
        }
        res.status(201).json({ data: message });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.sendMessage = sendMessage;
