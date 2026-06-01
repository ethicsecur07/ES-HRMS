import { axiosInstance } from './axiosInstance';
import type { Attendance } from '../types';

export const attendanceApi = {
  getToday: async () => {
    const response = await axiosInstance.get<Attendance[]>('/attendance/today');
    return response.data;
  },

  getAll: async () => {
    const response = await axiosInstance.get<Attendance[]>('/attendance');
    return response.data;
  },

  checkIn: async (data: { employeeId: string; ipAddress?: string; deviceInfo: string; overrideReason?: string }) => {
    const response = await axiosInstance.post<Attendance>('/attendance/checkin', data);
    return response.data;
  },

  checkOut: async (attendanceId: string, taskReportId?: string) => {
    const response = await axiosInstance.post<Attendance>(`/attendance/checkout/${attendanceId}`, { taskReportId });
    return response.data;
  },

  verifyOfficeIP: async () => {
    const response = await axiosInstance.get<{ isOfficeIP: boolean; currentIP: string }>('/attendance/verify-ip');
    return response.data;
  },

  update: async (id: string, data: { loginTime?: string; logoutTime?: string; status?: string }) => {
    const response = await axiosInstance.put<Attendance>(`/attendance/${id}`, data);
    return response.data;
  },

  getPendingReports: async () => {
    const response = await axiosInstance.get<Attendance[]>('/attendance/pending-reports');
    return response.data;
  },

  submitPendingReport: async (data: {
    attendanceId: string;
    completedTasks: string;
    inProgressTasks?: string;
    pendingTasks?: string;
    blockers?: string;
    tomorrowPlan?: string;
  }) => {
    const response = await axiosInstance.post<{ message: string; data: any }>('/attendance/submit-pending-report', data);
    return response.data;
  },
};
