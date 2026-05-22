import { axiosInstance } from './axiosInstance';
import type { Department } from '../types';

export const departmentApi = {
  getAll: async () => {
    const response = await axiosInstance.get<{ success: boolean; data: Department[] }>('/departments');
    return response.data as unknown as Department[];
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: Department }>(`/departments/${id}`);
    return response.data as unknown as Department;
  },

  create: async (data: Omit<Department, '_id' | 'createdAt' | 'updatedAt' | 'isActive'>) => {
    const response = await axiosInstance.post<{ success: boolean; message: string; data: Department }>('/departments', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Omit<Department, '_id' | 'createdAt' | 'updatedAt'>>) => {
    const response = await axiosInstance.put<{ success: boolean; message: string; data: Department }>(`/departments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/departments/${id}`);
    return response.data;
  },
};
