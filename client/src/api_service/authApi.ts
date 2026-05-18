import { axiosInstance } from './axiosInstance';
import type { User } from '../types';

export const authApi = {
  login: async (credentials: { email: string; password?: string; role?: string }) => {
    const response = await axiosInstance.post<{ user: User; token: string }>('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    await axiosInstance.post('/auth/logout');
  },

  getMe: async () => {
    const response = await axiosInstance.get<{ user: User }>('/auth/me');
    return response.data;
  },
};
