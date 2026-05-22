import axiosInstance from './axiosInstance';
import type { NotificationItem } from '../types';

export const notificationApi = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const res = await axiosInstance.get('/notifications');
    return res.data.notifications;
  },

  markAsRead: async (id: string): Promise<NotificationItem> => {
    const res = await axiosInstance.put(`/notifications/${id}/read`);
    return res.data.notification;
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosInstance.put('/notifications/read-all');
  }
};
