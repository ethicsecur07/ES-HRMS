"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentConversations = exports.markMessageRead = exports.sendFileMessage = exports.sendMessage = exports.getConversation = exports.chatUpload = void 0;
const Message_js_1 = require("../../models/Message.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
// Multer in-memory storage for chat file uploads
const storage = multer_1.default.memoryStorage();
exports.chatUpload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});
const getConversation = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;
        let query;
        if (otherUserId === 'broadcast' || otherUserId.startsWith('group_')) {
            query = { receiverId: otherUserId };
        }
        else {
            query = {
                $or: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            };
        }
        const messages = await Message_js_1.Message.find(query).sort({ createdAt: 1 });
        // Mark received messages as read (only for 1:1 chats)
        if (otherUserId !== 'broadcast' && !otherUserId.startsWith('group_')) {
            const unreadIds = messages
                .filter(m => m.senderId === otherUserId && m.receiverId === userId && !m.read)
                .map(m => m._id);
            if (unreadIds.length > 0) {
                await Message_js_1.Message.updateMany({ _id: { $in: unreadIds } }, { read: true });
                // Notify sender that messages have been read via socket
                const io = (0, socketHandler_js_1.getIO)();
                if (io) {
                    io.to(`user_${otherUserId}`).emit('messages_read', {
                        readBy: userId,
                        messageIds: unreadIds.map(id => id.toString()),
                    });
                }
            }
        }
        res.status(200).json({ success: true, data: { messages } });
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
        if (!receiverId || (!content && !req.file)) {
            res.status(400).json({ success: false, message: 'receiverId and content or file are required.' });
            return;
        }
        const message = new Message_js_1.Message({
            senderId,
            receiverId,
            content: content || '',
            messageType: 'text',
        });
        await message.save();
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            if (receiverId === 'broadcast') {
                io.to(`org_${req.user.organizationId}`).emit('receive_message', message);
            }
            else if (receiverId.startsWith('group_')) {
                io.to(receiverId).emit('receive_message', message);
            }
            else {
                // Emit to recipient and also back to sender (for multi-device sync)
                io.to(`user_${receiverId}`).emit('receive_message', message);
                io.to(`user_${senderId}`).emit('receive_message', message);
            }
        }
        // Only dispatch notification for 1:1 messages
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
        res.status(201).json({ success: true, data: message });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.sendMessage = sendMessage;
const sendFileMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId } = req.body;
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        if (!receiverId) {
            res.status(400).json({ success: false, message: 'receiverId is required.' });
            return;
        }
        // Determine message type
        const isImage = req.file.mimetype.startsWith('image/');
        const messageType = isImage ? 'image' : 'file';
        // Upload to Cloudinary
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        const uploadResult = await cloudinary_1.v2.uploader.upload(dataURI, {
            folder: 'es_hrms_chat',
            resource_type: isImage ? 'image' : 'raw',
        });
        const message = new Message_js_1.Message({
            senderId,
            receiverId,
            content: req.file.originalname,
            messageType,
            fileUrl: uploadResult.secure_url,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            fileType: req.file.mimetype,
        });
        await message.save();
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
                io.to(`user_${senderId}`).emit('receive_message', message);
            }
        }
        res.status(201).json({ success: true, data: message });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.sendFileMessage = sendFileMessage;
const markMessageRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const message = await Message_js_1.Message.findById(messageId);
        if (!message) {
            res.status(404).json({ success: false, message: 'Message not found.' });
            return;
        }
        // Only the receiver can mark as read
        if (message.receiverId !== userId) {
            res.status(403).json({ success: false, message: 'Forbidden.' });
            return;
        }
        message.read = true;
        await message.save();
        // Notify sender via socket
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`user_${message.senderId}`).emit('message_read', {
                messageId: message._id.toString(),
                readBy: userId,
            });
        }
        res.status(200).json({ success: true, data: { message } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markMessageRead = markMessageRead;
const getRecentConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const recentConversations = await Message_js_1.Message.aggregate([
            {
                $match: {
                    $or: [
                        { senderId: userId },
                        { receiverId: userId },
                        { receiverId: 'broadcast' },
                        { receiverId: { $regex: /^group_/ } }
                    ]
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            {
                                $or: [
                                    { $eq: ["$receiverId", "broadcast"] },
                                    { $eq: [{ $substr: ["$receiverId", 0, 6] }, "group_"] }
                                ]
                            },
                            "$receiverId",
                            {
                                $cond: [
                                    { $eq: ["$senderId", userId] },
                                    "$receiverId",
                                    "$senderId"
                                ]
                            }
                        ]
                    },
                    lastMessageAt: { $first: "$createdAt" },
                    lastMessageContent: { $first: "$content" },
                    lastMessageType: { $first: "$messageType" }
                }
            }
        ]);
        res.status(200).json({ success: true, data: { recentConversations } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getRecentConversations = getRecentConversations;
