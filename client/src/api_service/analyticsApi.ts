import { axiosInstance } from './axiosInstance';
import type { AuditLog, CompanySettings } from '../types';

export const analyticsApi = {
  getDashboardStats: async () => {
    const response = await axiosInstance.get('/analytics/dashboard');
    return response.data;
  },

  getAuditLogs: async () => {
    const response = await axiosInstance.get<{ auditLogs: AuditLog[] }>('/analytics/audit-logs');
    return response.data.auditLogs;
  },

  getSettings: async () => {
    const response = await axiosInstance.get<{ settings: CompanySettings }>('/settings');
    return response.data.settings;
  },

  updateSettings: async (data: Partial<CompanySettings>) => {
    const response = await axiosInstance.put<{ settings: CompanySettings }>('/settings', data);
    return response.data.settings;
  },
};
