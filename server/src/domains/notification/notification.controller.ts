import { Request, Response } from 'express';
import { Notification } from '../../models/Notification.js';

export const getUserNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const notifications = await Notification.find({ recipientId: userId })
      .sort({ createdAt: -1 })
      .limit(50);
      
    res.status(200).json({ success: true, notifications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      res.status(200).json({ success: true, message: 'Virtual notification marked as read' });
      return;
    }
    const notification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );
    res.status(200).json({ success: true, notification });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    await Notification.updateMany({ recipientId: userId, read: false }, { read: true });
    res.status(200).json({ success: true, message: 'All marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
