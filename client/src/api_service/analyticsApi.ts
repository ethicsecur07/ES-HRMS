import { axiosInstance } from './axiosInstance';
import type { AuditLog, CompanySettings } from '../types';

export const analyticsApi = {
  getDashboardStats: async () => {
    const response = await axiosInstance.get('/analytics/dashboard-stats');
    if (import.meta.env.DEV) {
      console.log('[analyticsApi] Full dashboard stats response:', response.data);
      console.log('[analyticsApi] employeeTrendsDepartmentWise:', (response.data as any)?.employeeTrendsDepartmentWise);
    }
    return response.data;
  },

  getAuditLogs: async () => {
    const response = await axiosInstance.get<{ auditLogs: AuditLog[] }>('/analytics/audit-logs');
    return response.data.auditLogs;
  },

  getSettings: async () => {
    const response = await axiosInstance.get<{ settings?: CompanySettings } & CompanySettings>('/analytics/settings');
    return response.data.settings || response.data;
  },

  updateSettings: async (data: Partial<CompanySettings>) => {
    const response = await axiosInstance.put<{ settings?: CompanySettings } & CompanySettings>('/analytics/settings', data);
    return response.data.settings || response.data;
  },

  getAnnouncementsAndActions: async () => {
    const response = await axiosInstance.get('/analytics/announcements-actions');
    return response.data;
  },
};
