import { axiosInstance } from './axiosInstance';
import type { User } from '../types';

export interface SSOProvider {
  type: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'SAML2' | 'OKTA' | 'AUTH0' | 'AZURE_AD' | string;
  name: string;
  isPrimary?: boolean;
  providerType?: string;
  clientId?: string;
  authUrl?: string;
}

export interface UserDevice {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  isTrusted: boolean;
  isBlocked: boolean;
  lastActiveAt: string;
}

export interface LoginEvent {
  _id: string;
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILED' | 'MFA_REQUIRED';
  failureReason?: string;
  createdAt: string;
}

export const authV2Api = {
  // SSO Endpoints
  getOrgProviders: async (orgSlug: string) => {
    const response = await axiosInstance.get<SSOProvider[]>(`/v2/auth/sso/providers/${orgSlug}`);
    return response.data;
  },

  initiateSSO: async (orgSlug: string, providerType: string) => {
    const response = await axiosInstance.get<{ authorizationUrl: string; state: string }>(
      `/v2/auth/sso/initiate/${orgSlug}/${providerType}`
    );
    if (response.data?.authorizationUrl) {
      sessionStorage.setItem('es-hrms-sso-context', JSON.stringify({ orgSlug, providerType }));
      window.location.href = response.data.authorizationUrl;
    }
  },

  handleSSOCallback: async (data: { code?: string; state?: string; orgSlug?: string; providerType?: string; SAMLResponse?: string }) => {
    const response = await axiosInstance.post<{ user: User; token: string }>('/v2/auth/sso/callback', data);
    return response.data;
  },

  // MFA Endpoints
  getMFAStatus: async () => {
    const response = await axiosInstance.get<{ isMFAEnabled: boolean }>('/v2/auth/mfa/status');
    return response.data;
  },

  setupMFA: async () => {
    const response = await axiosInstance.post<{ qrCode: string; secret: string }>('/v2/auth/mfa/setup');
    return response.data;
  },

  verifyMFA: async (code: string) => {
    const response = await axiosInstance.post<{ verified: boolean; token?: string }>('/v2/auth/mfa/verify', { code });
    return response.data;
  },

  verifyRecoveryCode: async (code: string) => {
    const response = await axiosInstance.post<{ verified: boolean; token?: string }>('/v2/auth/mfa/recovery', { code });
    return response.data;
  },

  disableMFA: async () => {
    const response = await axiosInstance.delete<{ message: string }>('/v2/auth/mfa/disable');
    return response.data;
  },

  // Device Management Endpoints
  getDevices: async () => {
    const response = await axiosInstance.get<UserDevice[]>('/v2/auth/devices');
    return response.data;
  },

  trustDevice: async (deviceId: string) => {
    const response = await axiosInstance.put<{ message: string; device: UserDevice }>(`/v2/auth/devices/${deviceId}/trust`);
    return response.data;
  },

  blockDevice: async (deviceId: string) => {
    const response = await axiosInstance.put<{ message: string; device: UserDevice }>(`/v2/auth/devices/${deviceId}/block`);
    return response.data;
  },

  removeDevice: async (deviceId: string) => {
    const response = await axiosInstance.delete<{ message: string }>(`/v2/auth/devices/${deviceId}`);
    return response.data;
  },

  // Login Audits & History
  getLoginHistory: async () => {
    const response = await axiosInstance.get<LoginEvent[]>('/v2/auth/login-history');
    return response.data;
  },

  getLoginEvents: async () => {
    const response = await axiosInstance.get<LoginEvent[]>('/v2/auth/login-events');
    return response.data;
  },

  // Identity Provider Admin Endpoints
  listProviders: async () => {
    const response = await axiosInstance.get<any[]>('/v2/auth/providers');
    return response.data;
  },

  registerProvider: async (providerData: any) => {
    const response = await axiosInstance.post<any>('/v2/auth/providers', providerData);
    return response.data;
  },

  removeProvider: async (providerType: string) => {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/v2/auth/providers/${providerType}`);
    return response.data;
  },
};
