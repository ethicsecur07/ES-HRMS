import { axiosInstance } from './axiosInstance';
import type { Employee } from '../types';

export const employeeApi = {
  getAll: async (params?: {
    search?: string;
    department?: string;
    designation?: string;
    departmentId?: string;
    designationId?: string;
    isActive?: string | boolean;
    isLoginApproved?: string | boolean;
    page?: number | string;
    limit?: number | string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const response = await axiosInstance.get<{ employees: Employee[]; total: number; page: number; limit: number }>('/employees', { params });
    return response.data;
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

  getNextEmployeeCode: async (isIntern?: boolean, departmentId?: string, designationId?: string) => {
    const response = await axiosInstance.get<{ nextCode: string }>('/employees/next-code', {
      params: { isIntern, departmentId, designationId }
    });
    return response.data.nextCode;
  },
  
  syncMicrosoft: async () => {
    const response = await axiosInstance.post<{
      success: boolean;
      totalMicrosoftUsers: number;
      filteredUsers: number;
      createdCount: number;
      updatedCount: number;
      errors: string[];
    }>('/employees/sync-microsoft');
    return response.data;
  },
};
