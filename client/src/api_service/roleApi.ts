import { axiosInstance } from './axiosInstance';

export interface RoleData {
  _id?: string;
  name: string;
  code: string;
  slug?: string;
  description?: string;
  parentRoleId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const roleApi = {
  getAll: async () => {
    const response = await axiosInstance.get<{ success: boolean; data: RoleData[] }>('/roles');
    return response.data as unknown as RoleData[];
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: RoleData }>(`/roles/${id}`);
    return response.data as unknown as RoleData;
  },

  create: async (data: Omit<RoleData, '_id' | 'slug' | 'createdAt' | 'updatedAt'>) => {
    const response = await axiosInstance.post<{ success: boolean; message: string; data: RoleData }>('/roles', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Omit<RoleData, '_id' | 'createdAt' | 'updatedAt'>>) => {
    const response = await axiosInstance.put<{ success: boolean; message: string; data: RoleData }>(`/roles/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/roles/${id}`);
    return response.data;
  },

  getMembers: async (id: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: any[] }>(`/roles/${id}/members`);
    return response.data;
  },

  updateMembers: async (id: string, userIds: string[]) => {
    const response = await axiosInstance.post<{ success: boolean; message: string }>(`/roles/${id}/members`, { userIds });
    return response.data;
  },
};
