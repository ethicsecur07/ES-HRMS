import { axiosInstance } from './axiosInstance';
import type { Designation } from '../types';

export const designationApi = {
  getAll: async (departmentId?: string) => {
    const response = await axiosInstance.get<Designation[]>('/designations', {
      params: { departmentId },
    });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: Designation }>(`/designations/${id}`);
    return response.data as unknown as Designation;
  },

  create: async (data: Omit<Designation, '_id' | 'createdAt' | 'updatedAt' | 'isActive'>) => {
    const response = await axiosInstance.post<{ success: boolean; message: string; data: Designation }>('/designations', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Omit<Designation, '_id' | 'createdAt' | 'updatedAt'>>) => {
    const response = await axiosInstance.put<{ success: boolean; message: string; data: Designation }>(`/designations/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/designations/${id}`);
    return response.data;
  },
};
