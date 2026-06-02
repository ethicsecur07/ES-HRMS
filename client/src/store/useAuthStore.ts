import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useNotificationStore } from './useNotificationStore';
import type { User, Role } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,

      login: (user, token) =>
        set({
          user,
          token,
          role: user.role,
          isAuthenticated: true,
        }),

      logout: () => {
        // Clear offline status first via API — use hostname-based URL so Device B
        // on the LAN hits the server, not its own localhost.
        const token = get().token;
        if (token) {
          const getApiUrl = () => {
            const envApiUrl = import.meta.env.VITE_API_URL;
            if (envApiUrl && !envApiUrl.includes('localhost')) return envApiUrl;
            return `${window.location.protocol}//${window.location.hostname}:5000/api`;
          };
          const apiUrl = getApiUrl();
          fetch(`${apiUrl}/chat/offline-hard`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }).catch(() => {});
        }
        useNotificationStore.getState().logoutClear();
        set({
          user: null,
          token: null,
          role: null,
          isAuthenticated: false,
        });
      },

      updateUser: (updatedFields) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        })),

      setToken: (token: string) => set({ token }),
    }),
    {
      name: 'es-hrms-auth',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        token: null,
      }),
    }
  )
);
