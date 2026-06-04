"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerChatBackup = exports.getOnlineUsers = exports.markOfflineHard = exports.getRecentConversations = exports.markMessageRead = exports.sendFileMessage = exports.sendMessage = exports.getConversation = exports.chatUpload = void 0;
const Message_js_1 = require("../../models/Message.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const User_js_1 = require("../../models/User.js");
const onedrive_js_1 = require("../../utils/onedrive.js");
const multer_1 = __importDefault(require("multer"));
const chatBackup_service_js_1 = require("../../services/chatBackup.service.js");
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
            const sender = await User_js_1.User.findById(senderId);
            const senderName = sender ? sender.name : 'Someone';
            await notification_service_js_1.notificationService.dispatchNotification({
                organizationId: req.user.organizationId,
                recipientId: receiverId,
                title: `New Message from ${senderName}`,
                message: content || 'Sent an attachment.',
                channels: ['IN_APP'],
                type: 'CHAT',
                payload: { senderId }
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
        const orgId = req.user.organizationId;
        const userEmail = req.user?.email;
        if (!orgId) {
            res.status(400).json({ success: false, message: 'User organization context is missing.' });
            return;
        }
        // Upload to OneDrive
        const onedriveResult = await (0, onedrive_js_1.uploadFileToOneDrive)(orgId, req.file.buffer, req.file.originalname, req.file.mimetype, 'uploads/chat', userEmail);
        // Generate sharing link
        const sharingUrl = await (0, onedrive_js_1.generateSharingLink)(orgId, onedriveResult.fileId, userEmail);
        const message = new Message_js_1.Message({
            senderId,
            receiverId,
            content: req.file.originalname,
            messageType,
            fileUrl: sharingUrl,
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
        // Only dispatch notification for 1:1 messages
        if (receiverId !== 'broadcast' && !receiverId.startsWith('group_')) {
            const sender = await User_js_1.User.findById(senderId);
            const senderName = sender ? sender.name : 'Someone';
            const description = messageType === 'image' ? 'Sent an image' : `Sent a file: ${req.file.originalname}`;
            await notification_service_js_1.notificationService.dispatchNotification({
                organizationId: req.user.organizationId,
                recipientId: receiverId,
                title: `New Message from ${senderName}`,
                message: description,
                channels: ['IN_APP'],
                type: 'CHAT',
                payload: { senderId }
            });
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
const markOfflineHard = async (req, res) => {
    try {
        const userId = req.user.id;
        (0, socketHandler_js_1.forceUserOffline)(userId);
        res.status(200).json({ success: true, message: 'User marked offline.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.markOfflineHard = markOfflineHard;
/**
 * GET /api/chat/online-users
 * Returns the list of user IDs currently online in the caller's organization.
 * Used as an HTTP fallback when socket events are missed (page load race, etc.).
 */
const getOnlineUsers = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const onlineUserIds = (0, socketHandler_js_1.getOnlineUserIdsByOrg)(organizationId);
        res.status(200).json({ success: true, data: { onlineUserIds } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getOnlineUsers = getOnlineUsers;
/**
 * POST /api/chat/admin/backup-sync
 * Trigger OneDrive chat backup manually for a specific date (YYYY-MM-DD) or yesterday.
 */
const triggerChatBackup = async (req, res) => {
    try {
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN' && userRole !== 'HR') {
            res.status(403).json({ success: false, message: 'Forbidden. Admin/HR role required.' });
            return;
        }
        const { date } = req.body;
        let targetDate;
        if (date) {
            targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                res.status(400).json({ success: false, message: 'Invalid date parameter. Use YYYY-MM-DD format.' });
                return;
            }
        }
        // Run backup asynchronously so it doesn't block the HTTP request
        (0, chatBackup_service_js_1.runGlobalChatBackup)(targetDate).catch(err => {
            console.error('[triggerChatBackup] Global backup failed async:', err);
        });
        res.status(200).json({
            success: true,
            message: `Chat backup job triggered successfully${date ? ` for date ${date}` : ' for yesterday'}.`,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.triggerChatBackup = triggerChatBackup;
