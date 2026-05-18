import { axiosInstance } from './axiosInstance';
import type { LeaveRequest, ApprovalStatus } from '../types';

export const leaveApi = {
  applyLeave: async (data: Omit<LeaveRequest, '_id' | 'status' | 'appliedAt'>) => {
    const response = await axiosInstance.post<{ leaveRequest: LeaveRequest }>('/leaves/apply', data);
    return response.data.leaveRequest;
  },

  getAll: async () => {
    const response = await axiosInstance.get<{ leaveRequests: LeaveRequest[] }>('/leaves');
    return response.data.leaveRequests;
  },

  updateStatus: async (id: string, status: ApprovalStatus, rejectionReason?: string) => {
    const response = await axiosInstance.put<{ leaveRequest: LeaveRequest }>(`/leaves/${id}/status`, { status, rejectionReason });
    return response.data.leaveRequest;
  },
};
