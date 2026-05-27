import { Request, Response } from 'express';
import { Message } from '../../models/Message.js';
import { getIO } from '../../sockets/socketHandler.js';
import { notificationService } from '../../services/notification.service.js';

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { otherUserId } = req.params;

    let query;
    if (otherUserId === 'broadcast' || otherUserId.startsWith('group_')) {
      // For broadcast and group chats, messages are queried by their channel identifier
      query = { receiverId: otherUserId };
    } else {
      // 1:1 chat query
      query = {
        $or: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ]
      };
    }

    const messages = await Message.find(query).sort({ createdAt: 1 });

    // Mark received messages as read (only relevant for 1:1 chats)
    if (otherUserId !== 'broadcast' && !otherUserId.startsWith('group_')) {
      await Message.updateMany(
        { senderId: otherUserId, receiverId: userId, read: false },
        { read: true }
      );
    }

    res.status(200).json({ data: { messages } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req as any).user.id;
    const { receiverId, content } = req.body;

    const message = new Message({
      senderId,
      receiverId,
      content
    });

    await message.save();

    // Emit via socket directly for chat
    const io = getIO();
    if (io) {
      if (receiverId === 'broadcast') {
        io.to(`org_${(req as any).user.organizationId}`).emit('receive_message', message);
      } else if (receiverId.startsWith('group_')) {
        io.to(receiverId).emit('receive_message', message);
      } else {
        io.to(`user_${receiverId}`).emit('receive_message', message);
      }
    }

    // Only dispatch notification for 1:1 messages to avoid broadcast spam
    if (receiverId !== 'broadcast' && !receiverId.startsWith('group_')) {
      await notificationService.dispatchNotification({
        organizationId: (req as any).user.organizationId,
        recipientId: receiverId,
        title: 'New Message',
        message: `You have a new message.`,
        channels: ['IN_APP'],
        type: 'CHAT'
      });
    }

    res.status(201).json({ data: message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
