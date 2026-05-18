import { axiosInstance } from './axiosInstance';
import type { Employee } from '../types';

export const employeeApi = {
  getAll: async () => {
    const response = await axiosInstance.get<{ employees: Employee[] }>('/employees');
    return response.data.employees;
  },

  getById: async (id: string) => {
    const response = await axiosInstance.get<{ employee: Employee }>(`/employees/${id}`);
    return response.data.employee;
  },

  create: async (data: Omit<Employee, '_id' | 'leaveBalance' | 'wfhBalance' | 'permissionHoursBalance' | 'isActive'>) => {
    const response = await axiosInstance.post<{ employee: Employee; generatedPassword?: string }>('/employees', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Employee>) => {
    const response = await axiosInstance.put<{ employee: Employee }>(`/employees/${id}`, data);
    return response.data.employee;
  },

  delete: async (id: string) => {
    await axiosInstance.delete(`/employees/${id}`);
  },
};
