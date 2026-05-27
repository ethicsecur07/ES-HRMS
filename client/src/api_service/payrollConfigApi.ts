import { axiosInstance } from './axiosInstance';
import type { PayrollConfig } from '../types';

export const payrollConfigApi = {
  get: async (employeeId?: string | null): Promise<{ config: PayrollConfig; stats?: { runCycle: string; startStr: string; endStr: string; casualLeaveDays: number; totalPermissionHours: number } | null }> => {
    const params = employeeId ? { employeeId } : {};
    const response = await axiosInstance.get<{ config: PayrollConfig; stats?: any }>('/payroll-config', { params });
    return response.data;
  },

  save: async (config: Partial<PayrollConfig>): Promise<{ config: PayrollConfig; message: string }> => {
    const response = await axiosInstance.put<{ config: PayrollConfig; message: string }>('/payroll-config', config);
    return response.data;
  },
};
