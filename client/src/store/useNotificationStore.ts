import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  clearedNotificationIds: string[];
  addNotification: (notification: Omit<NotificationItem, '_id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  clearNotifications: () => void;
  logoutClear: () => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,
      toasts: [],
      unreadCount: INITIAL_NOTIFICATIONS.filter((n) => !n.read).length,
      clearedNotificationIds: [],

      addNotification: (notif) =>
        set((state) => {
          const targetId = (notif as any)._id;
          if (targetId && (state.notifications.some((n) => n._id === targetId) || state.clearedNotificationIds.includes(targetId))) {
            return {};
          }
          const newItem: NotificationItem = {
            ...notif,
            _id: targetId || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

      addToast: (title, message, type = 'info') => {
        const id = `toast-${Date.now()}`;
        set((state) => ({ toasts: [...state.toasts, { id, title, message, type }] }));
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
        }, 5000);
      },

      removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      clearNotifications: () =>
        set((state) => {
          const clearedIds = state.notifications.map((n) => n._id);
          return {
            notifications: INITIAL_NOTIFICATIONS,
            toasts: [],
            unreadCount: 0,
            clearedNotificationIds: Array.from(new Set([...state.clearedNotificationIds, ...clearedIds])),
          };
        }),

      logoutClear: () =>
        set({
          notifications: INITIAL_NOTIFICATIONS,
          toasts: [],
          unreadCount: 0,
          clearedNotificationIds: [],
        }),
    }),
    {
      name: 'es-hrms-notifications',
      partialize: (state) => ({ 
        notifications: state.notifications,
        clearedNotificationIds: state.clearedNotificationIds 
      }),
    }
  )
);
