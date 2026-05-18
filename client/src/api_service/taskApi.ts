import { axiosInstance } from './axiosInstance';
import type { TaskReport } from '../types';

export const taskApi = {
  submitDailyReport: async (data: Omit<TaskReport, '_id' | 'submittedAt'>) => {
    const response = await axiosInstance.post<{ taskReport: TaskReport }>('/tasks/report', data);
    return response.data.taskReport;
  },

  getAllReports: async () => {
    const response = await axiosInstance.get<{ taskReports: TaskReport[] }>('/tasks/reports');
    return response.data.taskReports;
  },

  getByEmployee: async (employeeId: string) => {
    const response = await axiosInstance.get<{ taskReports: TaskReport[] }>(`/tasks/reports/${employeeId}`);
    return response.data.taskReports;
  },
};
