import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NotificationItem } from '../types';
import { io, Socket } from 'socket.io-client';
import { notificationApi } from '../api_service/notificationApi';
import axiosInstance from '../api_service/axiosInstance';

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
  activeChatUserId: string | null;
  onlineUserIds: string[];
  /** Per-conversation unread DM counts: key = senderId or groupId */
  unreadChatCounts: Record<string, number>;
  /** Last message timestamp per conversation: key = userId/groupId */
  lastMessageAt: Record<string, string>;

  setActiveChatUserId: (id: string | null) => void;
  addNotification: (notification: Omit<NotificationItem, '_id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addToast: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  clearNotifications: () => void;
  logoutClear: () => void;
  initializeSocket: (token: string, currentUserId?: string) => void;
  fetchNotifications: () => Promise<void>;
  /** HTTP fallback: sync online presence from server — called on connect & periodically */
  fetchOnlineUsers: () => Promise<void>;
  /** Clear unread count when opening a conversation */
  clearUnreadChat: (conversationId: string) => void;
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
      activeChatUserId: null,
      onlineUserIds: [],
      unreadChatCounts: {},
      lastMessageAt: {},

      setActiveChatUserId: (id) => set({ activeChatUserId: id }),

      clearUnreadChat: (conversationId) =>
        set((state) => ({
          unreadChatCounts: { ...state.unreadChatCounts, [conversationId]: 0 },
        })),

      fetchNotifications: async () => {
        try {
          const notifs = await notificationApi.getNotifications();
          set({
            notifications: notifs,
            unreadCount: notifs.filter((n) => !n.read).length,
          });
        } catch (err) {
          console.error('Failed to fetch notifications:', err);
        }
      },

      /**
       * fetchOnlineUsers — HTTP fallback to sync presence.
       * Called on socket connect (handles page-load race with socket events)
       * and periodically from ChatPage (handles missed events on poor networks).
       * The axiosInstance already has cross-device URL logic baked in.
       */
      fetchOnlineUsers: async () => {
        try {
          const res = await axiosInstance.get('/chat/online-users');
          // axiosInstance unwraps { success, data: { onlineUserIds } } → { onlineUserIds }
          const onlineUserIds: string[] = res.data?.onlineUserIds ?? [];
          if (Array.isArray(onlineUserIds)) {
            set({ onlineUserIds });
          }
        } catch (err) {
          console.warn('[Presence] HTTP sync failed (socket is primary):', err);
        }
      },

      initializeSocket: (token, currentUserId) => {
        const state = get();

        // If a socket already exists and is connected, just update the auth token
        // and return — do NOT create a second socket or re-register listeners.
        if (state.socket) {
          state.socket.auth = { token };
          if (state.socket.disconnected) {
            state.socket.connect();
          }
          return;
        }

        /**
         * getSocketUrl — mirrors the same logic as axiosInstance.getBaseUrl() so
         * Device B on the LAN correctly points to the server machine's IP rather
         * than its own localhost.
         *
         * Priority:
         *   1. VITE_API_URL set to a real host (prod/staging) → strip "/api"
         *   2. Fallback → use window.location.hostname (works cross-device)
         */
        const getSocketUrl = () => {
          const envApiUrl = import.meta.env.VITE_API_URL;
          if (envApiUrl && !envApiUrl.includes('localhost')) {
            return envApiUrl.replace('/api', '').replace(/\/$/, '');
          }
          // Use the actual hostname the browser used — resolves correctly from
          // any device that can reach this Vite dev server.
          return `${window.location.protocol}//${window.location.hostname}:5000`;
        };

        const socketUrl = getSocketUrl();
        const socket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          autoConnect: true,
          auth: { token },
          // Reconnect indefinitely with exponential back-off (Socket.IO default)
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        // ── Remove any stale listeners before registering fresh ones ──────────
        // This prevents duplicate handlers if initializeSocket is ever called
        // again on the same socket object (e.g. React StrictMode double-invoke).
        socket.removeAllListeners();

        socket.on('connect', () => {
          console.log('[Socket] Connected to EthicSec real-time server:', socket.id);
          // HTTP sync on every connect/reconnect — ensures correct state
          // even if the 'online_users' socket event was missed due to a race.
          get().fetchOnlineUsers();
        });

        socket.on('disconnect', (reason) => {
          console.warn('[Socket] Disconnected:', reason);
        });

        socket.on('connect_error', (err) => {
          console.error('[Socket] Connection error:', err.message);
        });

        socket.on('new_notification', (notif: NotificationItem) => {
          get().addNotification(notif);
          // Only show toast for non-chat notifications (chat has its own badge)
          if (notif.type !== 'CHAT') {
            get().addToast(notif.title, notif.message, 'info');
          }
        });

        // ── Online Presence ──────────────────────────────────────────────────
        // Full list of currently-online users in this org (sent on connect)
        socket.on('online_users', (userIds: string[]) => {
          set({ onlineUserIds: userIds });
        });

        // Another user came online
        socket.on('user_online', ({ userId }: { userId: string }) => {
          set((s) => ({
            onlineUserIds: s.onlineUserIds.includes(userId)
              ? s.onlineUserIds
              : [...s.onlineUserIds, userId],
          }));
        });

        // Another user went offline
        socket.on('user_offline', ({ userId }: { userId: string }) => {
          set((s) => ({
            onlineUserIds: s.onlineUserIds.filter((id) => id !== userId),
          }));
        });

        // ── Chat message tracking (unread badges & sidebar sort order) ───────
        socket.on('receive_message', (msg: any) => {
          const { activeChatUserId } = get();
          const senderId: string = msg.senderId;
          const receiverId: string = msg.receiverId;
          const now: string = msg.createdAt || new Date().toISOString();

          // Skip messages we ourselves sent (server echoes back to sender room)
          const isOwnMessage = currentUserId && senderId === currentUserId;

          // Determine the conversation key for sorting & unread count:
          //   • Groups / broadcast → use the room id as the key
          //   • DMs               → key is the OTHER person's id
          let conversationKey: string | null = null;

          if (receiverId === 'broadcast' || receiverId?.startsWith('group_')) {
            conversationKey = receiverId;
          } else if (isOwnMessage) {
            // We sent it — conversation is with the receiver
            conversationKey = receiverId;
          } else {
            // We received it — conversation is with the sender
            conversationKey = senderId;
          }

          if (!conversationKey) return;

          // Always update lastMessageAt (for both sent and received) so the
          // sidebar sort order stays correct in real-time
          set((s) => ({
            lastMessageAt: { ...s.lastMessageAt, [conversationKey!]: now },
          }));

          // Increment unread count only for RECEIVED messages in non-active convos
          const isCurrentlyViewing = activeChatUserId === conversationKey;
          if (!isOwnMessage && !isCurrentlyViewing) {
            set((s) => ({
              unreadChatCounts: {
                ...s.unreadChatCounts,
                [conversationKey!]: (s.unreadChatCounts[conversationKey!] || 0) + 1,
              },
            }));
          }
        });

        set({ socket });
      },

      addNotification: (notif) =>
        set((state) => {
          const targetId = (notif as any)._id;
          if (
            targetId &&
            (state.notifications.some((n) => n._id === targetId) ||
              state.clearedNotificationIds.includes(targetId))
          ) {
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
          if (/^[0-9a-fA-F]{24}$/.test(id)) {
            await notificationApi.markAsRead(id);
          }
          set((state) => {
            const updated = state.notifications.map((n) =>
              n._id === id ? { ...n, read: true } : n
            );
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
            clearedNotificationIds: Array.from(
              new Set([...state.clearedNotificationIds, ...clearedIds])
            ),
          };
        }),

      logoutClear: () => {
        const { socket } = get();
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
        }
        set({
          notifications: INITIAL_NOTIFICATIONS,
          toasts: [],
          unreadCount: 0,
          clearedNotificationIds: [],
          activeChatUserId: null,
          onlineUserIds: [],
          unreadChatCounts: {},
          lastMessageAt: {},
          socket: null,
        });
      },
    }),
    {
      name: 'es-hrms-notifications',
      partialize: (state) => ({
        notifications: state.notifications,
        clearedNotificationIds: state.clearedNotificationIds,
        lastMessageAt: state.lastMessageAt,
        unreadChatCounts: state.unreadChatCounts,
        // IMPORTANT: socket, onlineUserIds must NOT be persisted —
        // they are live runtime state that must be re-established on each load.
      }),
      /**
       * After every localStorage hydration, forcibly reset runtime-only state.
       * This prevents stale onlineUserIds (from an older schema version that
       * persisted them) from leaking into the current session.
       */
      onRehydrateStorage: () => (rehydratedState) => {
        if (rehydratedState) {
          rehydratedState.onlineUserIds = [];
          rehydratedState.socket = null;
        }
      },
    }
  )
);
