import { axiosInstance } from './axiosInstance';
import type { RoleData } from './roleApi';

export interface PermissionActions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  assign: boolean;
  export: boolean;
}

export interface PermissionData {
  _id?: string;
  roleId?: string | null;
  userId?: string | null;
  module: string;
  actions: PermissionActions;
  restrictedFields: string[];
  policyCondition?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatrixResponse {
  modules: string[];
  roles: RoleData[];
  permissions: PermissionData[];
}

export interface MatrixUpdateRequest {
  roleId: string;
  module: string;
  actions: PermissionActions;
  restrictedFields?: string[];
  policyCondition?: any;
}

export const authPermissionApi = {
  getMatrix: async () => {
    const response = await axiosInstance.get<{ success: boolean; data: MatrixResponse }>('/auth-permissions/matrix');
    return response.data.data;
  },

  updateMatrix: async (updates: MatrixUpdateRequest[]) => {
    const response = await axiosInstance.put<{ success: boolean; message: string }>('/auth-permissions/matrix', { updates });
    return response.data;
  },

  getUserOverrides: async (userId: string) => {
    const response = await axiosInstance.get<{ success: boolean; data: PermissionData[] }>(`/auth-permissions/overrides`, {
      params: { userId },
    });
    return response.data.data;
  },

  upsertUserOverride: async (data: {
    userId: string;
    module: string;
    actions: PermissionActions;
    restrictedFields?: string[];
    policyCondition?: any;
  }) => {
    const response = await axiosInstance.post<{ success: boolean; message: string; data: PermissionData }>('/auth-permissions/overrides', data);
    return response.data;
  },

  deleteUserOverride: async (userId: string, module: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>('/auth-permissions/overrides', {
      data: { userId, module },
    });
    return response.data;
  },

  getMyPermissions: async () => {
    const response = await axiosInstance.get<{
      success: boolean;
      data: Record<string, { actions: PermissionActions; restrictedFields: string[]; policyCondition: any }>;
    }>('/auth-permissions/my-permissions');
    return response.data.data;
  },
};
