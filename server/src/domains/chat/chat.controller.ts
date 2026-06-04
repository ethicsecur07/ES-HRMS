import { Request, Response } from 'express';
import { Message } from '../../models/Message.js';
import { getIO, forceUserOffline, getOnlineUserIdsByOrg } from '../../sockets/socketHandler.js';
import { notificationService } from '../../services/notification.service.js';
import { User } from '../../models/User.js';
import { uploadFileToOneDrive, generateSharingLink } from '../../utils/onedrive.js';
import multer from 'multer';

// Multer in-memory storage for chat file uploads
const storage = multer.memoryStorage();
export const chatUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { otherUserId } = req.params;

    let query;
    if (otherUserId === 'broadcast' || otherUserId.startsWith('group_')) {
      query = { receiverId: otherUserId };
    } else {
      query = {
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      };
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });

    // Mark received messages as read (only for 1:1 chats)
    if (otherUserId !== 'broadcast' && !otherUserId.startsWith('group_')) {
      const unreadIds = messages
        .filter(m => m.senderId === otherUserId && m.receiverId === userId && !m.read)
        .map(m => m._id);

      if (unreadIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadIds } },
          { read: true }
        );

        // Notify sender that messages have been read via socket
        const io = getIO();
        if (io) {
          io.to(`user_${otherUserId}`).emit('messages_read', {
            readBy: userId,
            messageIds: unreadIds.map(id => id.toString()),
          });
        }
      }
    }

    res.status(200).json({ success: true, data: { messages } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).user.id;
    const { receiverId, content } = req.body;

    if (!receiverId || (!content && !req.file)) {
      res.status(400).json({ success: false, message: 'receiverId and content or file are required.' });
      return;
    }

    const message = new Message({
      senderId,
      receiverId,
      content: content || '',
      messageType: 'text',
    });

    await message.save();

    const io = getIO();
    if (io) {
      if (receiverId === 'broadcast') {
        io.to(`org_${(req as any).user.organizationId}`).emit('receive_message', message);
      } else if (receiverId.startsWith('group_')) {
        io.to(receiverId).emit('receive_message', message);
      } else {
        // Emit to recipient and also back to sender (for multi-device sync)
        io.to(`user_${receiverId}`).emit('receive_message', message);
        io.to(`user_${senderId}`).emit('receive_message', message);
      }
    }

    // Only dispatch notification for 1:1 messages
    if (receiverId !== 'broadcast' && !receiverId.startsWith('group_')) {
      const sender = await User.findById(senderId);
      const senderName = sender ? sender.name : 'Someone';
      await notificationService.dispatchNotification({
        organizationId: (req as any).user.organizationId,
        recipientId: receiverId,
        title: `New Message from ${senderName}`,
        message: content || 'Sent an attachment.',
        channels: ['IN_APP'],
        type: 'CHAT',
        payload: { senderId }
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const sendFileMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).user.id;
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

    const orgId = (req as any).user.organizationId;
    const userEmail = (req as any).user?.email;
    if (!orgId) {
      res.status(400).json({ success: false, message: 'User organization context is missing.' });
      return;
    }

    // Upload to OneDrive
    const onedriveResult = await uploadFileToOneDrive(
      orgId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      'uploads/chat',
      userEmail
    );

    // Generate sharing link
    const sharingUrl = await generateSharingLink(orgId, onedriveResult.fileId, userEmail);

    const message = new Message({
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

    const io = getIO();
    if (io) {
      if (receiverId === 'broadcast') {
        io.to(`org_${(req as any).user.organizationId}`).emit('receive_message', message);
      } else if (receiverId.startsWith('group_')) {
        io.to(receiverId).emit('receive_message', message);
      } else {
        io.to(`user_${receiverId}`).emit('receive_message', message);
        io.to(`user_${senderId}`).emit('receive_message', message);
      }
    }

    // Only dispatch notification for 1:1 messages
    if (receiverId !== 'broadcast' && !receiverId.startsWith('group_')) {
      const sender = await User.findById(senderId);
      const senderName = sender ? sender.name : 'Someone';
      const description = messageType === 'image' ? 'Sent an image' : `Sent a file: ${req.file.originalname}`;
      await notificationService.dispatchNotification({
        organizationId: (req as any).user.organizationId,
        recipientId: receiverId,
        title: `New Message from ${senderName}`,
        message: description,
        channels: ['IN_APP'],
        type: 'CHAT',
        payload: { senderId }
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markMessageRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
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
    const io = getIO();
    if (io) {
      io.to(`user_${message.senderId}`).emit('message_read', {
        messageId: message._id.toString(),
        readBy: userId,
      });
    }

    res.status(200).json({ success: true, data: { message } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecentConversations = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const recentConversations = await Message.aggregate([
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
                  { $eq: [ { $substr: ["$receiverId", 0, 6] }, "group_" ] }
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markOfflineHard = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    forceUserOffline(userId);
    res.status(200).json({ success: true, message: 'User marked offline.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/chat/online-users
 * Returns the list of user IDs currently online in the caller's organization.
 * Used as an HTTP fallback when socket events are missed (page load race, etc.).
 */
export const getOnlineUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizationId = (req as any).user.organizationId;
    const onlineUserIds = getOnlineUserIdsByOrg(organizationId);
    res.status(200).json({ success: true, data: { onlineUserIds } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
