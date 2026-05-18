import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
}

const DEMO_USERS: Record<Role, User> = {
  ADMIN: {
    _id: 'user-admin-101',
    name: 'Alexander Wright',
    email: 'admin@ethicsec.com',
    role: 'ADMIN',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  HR: {
    _id: 'user-hr-202',
    name: 'Sarah Jenkins',
    email: 'hr@ethicsec.com',
    role: 'HR',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
  EMPLOYEE: {
    _id: 'user-emp-303',
    name: 'Logapriyan M',
    email: 'logapriyan@ethicsec.com',
    role: 'EMPLOYEE',
    employeeId: 'emp-dev-001',
    isActive: true,
    lastLogin: new Date().toISOString(),
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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

      logout: () =>
        set({
          user: null,
          token: null,
          role: null,
          isAuthenticated: false,
        }),

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
    }),
    {
      name: 'es-hrms-auth',
    }
  )
);
