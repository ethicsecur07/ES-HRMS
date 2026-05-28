import { axiosInstance } from './axiosInstance';
import type { PayrollConfig } from '../types';

export const payrollConfigApi = {
  get: async (employeeId?: string | null): Promise<PayrollConfig> => {
    const params = employeeId ? { employeeId } : {};
    const response = await axiosInstance.get<{ config: PayrollConfig }>('/payroll-config', { params });
    return response.data.config;
  },

  save: async (config: Partial<PayrollConfig>): Promise<{ config: PayrollConfig; message: string }> => {
    const response = await axiosInstance.put<{ config: PayrollConfig; message: string }>('/payroll-config', config);
    return response.data;
  },
};
