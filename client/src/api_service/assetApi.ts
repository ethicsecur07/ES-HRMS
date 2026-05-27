import { axiosInstance } from './axiosInstance';

export interface AssetData {
  _id?: string;
  name: string;
  serialNumber: string;
  type: string;
  assignedTo?: any;
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
  purchaseDate?: string;
  cost?: number;
  notes?: string;
  createdAt?: string;
}

export const assetApi = {
  getAll: async (params?: { status?: string; type?: string; employeeId?: string }) => {
    const response = await axiosInstance.get<{ success: boolean; data: AssetData[] }>('/assets', { params });
    return response.data.data;
  },

  getEmployeeAssets: async (employeeId: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: AssetData[] }>(`/assets/employee/${employeeId}`);
    return response.data.data;
  },

  create: async (data: Omit<AssetData, '_id' | 'createdAt'>) => {
    const response = await axiosInstance.post<{ success: boolean; data: AssetData }>('/assets', data);
    return response.data;
  },

  update: async (id: string, data: Partial<AssetData>) => {
    const response = await axiosInstance.put<{ success: boolean; data: AssetData }>(`/assets/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/assets/${id}`);
    return response.data;
  },
};
