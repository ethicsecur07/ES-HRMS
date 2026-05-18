import { axiosInstance } from './axiosInstance';
import type { PermissionRequest, ApprovalStatus } from '../types';

export const permissionApi = {
  applyPermission: async (data: Omit<PermissionRequest, '_id' | 'approvalStatus' | 'appliedAt'>) => {
    const response = await axiosInstance.post<{ permissionRequest: PermissionRequest }>('/permissions/apply', data);
    return response.data.permissionRequest;
  },

  getAll: async () => {
    const response = await axiosInstance.get<{ permissionRequests?: PermissionRequest[]; permissions?: PermissionRequest[] }>('/permissions');
    return response.data.permissions || response.data.permissionRequests || [];
  },

  updateStatus: async (id: string, approvalStatus: ApprovalStatus) => {
    const response = await axiosInstance.put<{ permissionRequest: PermissionRequest }>(`/permissions/${id}/status`, { approvalStatus, status: approvalStatus });
    return response.data.permissionRequest;
  },
};
