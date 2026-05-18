import { axiosInstance } from './axiosInstance';
import type { Payroll } from '../types';

export const payrollApi = {
  getAll: async () => {
    const response = await axiosInstance.get<{ payrolls: Payroll[] }>('/payrolls');
    return response.data.payrolls;
  },

  updateStatus: async (id: string, paidStatus: Payroll['paidStatus']) => {
    const response = await axiosInstance.put<{ payroll: Payroll }>(`/payrolls/${id}/status`, { paidStatus });
    return response.data.payroll;
  },

  generateMonthlyPayroll: async (month: string) => {
    const response = await axiosInstance.post<{ payrolls: Payroll[] }>('/payrolls/generate', { month });
    return response.data.payrolls;
  },
};
