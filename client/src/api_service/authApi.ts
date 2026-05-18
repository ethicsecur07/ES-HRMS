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

  updateMe: async (data: { profileImage?: string; name?: string; phone?: string; address?: string; emergencyContact?: { name: string; relationship: string; phone: string } }) => {
    const response = await axiosInstance.put<{ user: User }>('/auth/me', data);
    return response.data;
  },

  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await axiosInstance.post<{ url: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.url;
  },
};
