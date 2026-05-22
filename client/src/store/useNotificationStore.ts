import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotificationItem } from '../types';
import { io, Socket } from 'socket.io-client';
import { notificationApi } from '../api_service/notificationApi';

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
  initializeSocket: (token: string) => void;
  fetchNotifications: () => Promise<void>;
  socket: Socket | null;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: INITIAL_NOTIFICATIONS,
      toasts: [],
      unreadCount: 0,
      clearedNotificationIds: [],
      socket: null,

      fetchNotifications: async () => {
        try {
          const notifs = await notificationApi.getNotifications();
          set({ 
            notifications: notifs,
            unreadCount: notifs.filter(n => !n.read).length
          });
        } catch (err) {
          console.error('Failed to fetch notifications:', err);
        }
      },

      initializeSocket: (token) => {
        const state = get();
        if (state.socket) return; // Already connected

        const getSocketUrl = () => {
          const envApiUrl = import.meta.env.VITE_API_URL;
          if (envApiUrl && !envApiUrl.includes('localhost')) {
            return envApiUrl.replace('/api', '');
          }
          return `${window.location.protocol}//${window.location.hostname}:5000`;
        };
        const socketUrl = getSocketUrl();
        const socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          auth: { token }
        });

        socket.on('connect', () => {
          console.log('Notification socket connected');
        });

        socket.on('new_notification', (notif: NotificationItem) => {
          get().addNotification(notif);
          get().addToast(notif.title, notif.message, 'info');
        });

        set({ socket });
      },

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

      markAsRead: async (id) => {
        try {
          await notificationApi.markAsRead(id);
          set((state) => {
            const updated = state.notifications.map((n) => (n._id === id ? { ...n, read: true } : n));
            return {
              notifications: updated,
              unreadCount: updated.filter((n) => !n.read).length,
            };
          });
        } catch (err) {
          console.error('Failed to mark as read', err);
        }
      },

      markAllAsRead: async () => {
        try {
          await notificationApi.markAllAsRead();
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
            unreadCount: 0,
          }));
        } catch (err) {
          console.error('Failed to mark all as read', err);
        }
      },

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

      logoutClear: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
        }
        set({
          notifications: INITIAL_NOTIFICATIONS,
          toasts: [],
          unreadCount: 0,
          clearedNotificationIds: [],
          socket: null
        });
      },
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
