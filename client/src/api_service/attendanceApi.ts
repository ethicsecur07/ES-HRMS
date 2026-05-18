import { axiosInstance } from './axiosInstance';
import type { Attendance } from '../types';

export const attendanceApi = {
  getToday: async () => {
    const response = await axiosInstance.get<{ attendances: Attendance[] }>('/attendance/today');
    return response.data.attendances;
  },

  checkIn: async (data: { employeeId: string; ipAddress: string; deviceInfo: string; overrideReason?: string }) => {
    const response = await axiosInstance.post<{ attendance: Attendance }>('/attendance/checkin', data);
    return response.data.attendance;
  },

  checkOut: async (attendanceId: string, taskReportId: string) => {
    const response = await axiosInstance.post<{ attendance: Attendance }>(`/attendance/checkout/${attendanceId}`, { taskReportId });
    return response.data.attendance;
  },

  verifyOfficeIP: async () => {
    const response = await axiosInstance.get<{ isOfficeIP: boolean; currentIP: string }>('/attendance/verify-ip');
    return response.data;
  },
};
