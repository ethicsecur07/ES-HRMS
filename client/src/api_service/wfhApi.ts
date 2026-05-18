import { axiosInstance } from './axiosInstance';
import type { LeaveRequest, ApprovalStatus } from '../types';

export const wfhApi = {
  applyWFH: async (data: { employeeId: string; date: string; reason: string; expectedTasks: string }) => {
    const response = await axiosInstance.post<{ wfhRequest: LeaveRequest }>('/wfh/apply', data);
    return response.data.wfhRequest;
  },

  getAll: async () => {
    const response = await axiosInstance.get<{ wfhRequests: LeaveRequest[] }>('/wfh');
    return response.data.wfhRequests;
  },

  updateStatus: async (id: string, status: ApprovalStatus, rejectionReason?: string) => {
    const response = await axiosInstance.put<{ wfhRequest: LeaveRequest }>(`/wfh/${id}/status`, { status, rejectionReason });
    return response.data.wfhRequest;
  },
};
