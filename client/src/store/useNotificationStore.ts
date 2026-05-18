import { create } from 'zustand';
import type { NotificationItem } from '../types';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationState {
  notifications: NotificationItem[];
  toasts: Toast[];
  unreadCount: number;
  addNotification: (notification: Omit<NotificationItem, '_id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    _id: 'notif-1',
    recipientId: 'all',
    title: 'Payroll Processed',
    message: 'Monthly salary for May 2026 has been successfully credited.',
    type: 'PAYROLL',
    read: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'notif-2',
    recipientId: 'user-emp-303',
    title: 'WFH Request Approved',
    message: 'Your WFH request for tomorrow has been approved by HR.',
    type: 'WFH',
    read: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    _id: 'notif-3',
    recipientId: 'user-hr-202',
    title: 'New Leave Request',
    message: 'Logapriyan applied for Casual Leave on May 20, 2026.',
    type: 'LEAVE',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: INITIAL_NOTIFICATIONS,
  toasts: [],
  unreadCount: INITIAL_NOTIFICATIONS.filter((n) => !n.read).length,

  addNotification: (notif) =>
    set((state) => {
      const newItem: NotificationItem = {
        ...notif,
        _id: `notif-${Date.now()}`,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newItem, ...state.notifications];
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) => (n._id === id ? { ...n, read: true } : n));
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  addToast: (title, message, type = 'info') =>
    set((state) => {
      const id = `toast-${Date.now()}`;
      return { toasts: [...state.toasts, { id, title, message, type }] };
    }),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
