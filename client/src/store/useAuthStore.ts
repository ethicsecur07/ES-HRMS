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
  setDemoUser: (role: Role) => void;
  setToken: (token: string) => void;
}

const DEMO_USERS: Record<Role, User> = {
  ADMIN: {
    _id: '605c72ef1f77bcf86cd79101',
    name: 'Abishek',
    email: 'Official@ethicsecur.co.in',
    role: 'ADMIN',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  MANAGER: {
    _id: '605c72ef1f77bcf86cd79404',
    name: 'Siddharth',
    email: 'siddharth@ethicsecur.com',
    role: 'MANAGER',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  HR: {
    _id: '605c72ef1f77bcf86cd79202',
    name: 'Oviya',
    email: 'oviya@ethicsecur.com',
    role: 'HR',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  TEAM_LEAD: {
    _id: '605c72ef1f77bcf86cd79505',
    name: 'Karthik',
    email: 'karthik@ethicsecur.com',
    role: 'TEAM_LEAD',
    employeeId: '605c72ef1f77bcf86cd79002',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  EMPLOYEE: {
    _id: '605c72ef1f77bcf86cd79303',
    name: 'Logapriyan M',
    email: 'logapriyan@ethicsec.com',
    role: 'EMPLOYEE',
    employeeId: '605c72ef1f77bcf86cd79001',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
};

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
        // Clear offline status first via API
        const token = get().token;
        if (token) {
          const getApiUrl = () => {
            const envApiUrl = import.meta.env.VITE_API_URL;
            if (envApiUrl) return envApiUrl;
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

      setDemoUser: (role: Role) =>
        set({
          user: DEMO_USERS[role],
          token: `demo-jwt-token-${role.toLowerCase()}`,
          role: role,
          isAuthenticated: true,
        }),

      setToken: (token: string) => set({ token }),
    }),
    {
      name: 'es-hrms-auth',
      // Secure token handling: Do NOT persist the access token in localStorage
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        // Only persist demo tokens, never real access tokens
        token: state.token?.startsWith('demo-jwt-token') ? state.token : null,
      }),
    }
  )
);
