import { Request, Response } from 'express';
import { Message } from '../../models/Message.js';
import { getIO } from '../../sockets/socketHandler.js';
import { notificationService } from '../../services/notification.service.js';

export const getConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { otherUserId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    }).sort({ createdAt: 1 });

    // Mark received messages as read
    await Message.updateMany(
      { senderId: otherUserId, receiverId: userId, read: false },
      { read: true }
    );

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
      io.to(`user_${receiverId}`).emit('receive_message', message);
    }

    // Also trigger notification service
    await notificationService.dispatchNotification({
      organizationId: (req as any).user.organizationId,
      recipientId: receiverId,
      title: 'New Message',
      message: `You have a new message.`,
      channels: ['IN_APP'], // Could be Push or Email depending on settings
      type: 'CHAT'
    });

    res.status(201).json({ data: message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
