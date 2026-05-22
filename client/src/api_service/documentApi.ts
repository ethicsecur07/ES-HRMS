import { axiosInstance } from './axiosInstance';

export interface DocumentVersion {
  version: number;
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
  } | string;
}

export interface HRDocument {
  _id: string;
  organizationId: string;
  employeeId: {
    _id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    department: string;
  } | string;
  name: string;
  category: 'CONTRACT' | 'PASSPORT' | 'VISA' | 'ID_PROOF' | 'CERTIFICATE' | 'OTHER';
  fileUrl: string;
  version: number;
  versions: DocumentVersion[];
  expiresAt?: string;
  signatureStatus: 'PENDING' | 'SIGNED' | 'NOT_REQUIRED';
  signedAt?: string;
  signatureProviderId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const documentApi = {
  getDocuments: async (params?: { employeeId?: string; category?: string }) => {
    const response = await axiosInstance.get<HRDocument[]>('/documents', { params });
    return response.data;
  },

  uploadDocument: async (data: {
    employeeId?: string;
    name: string;
    category: string;
    fileUrl: string;
    expiresAt?: string;
    signatureStatus?: string;
  }) => {
    const response = await axiosInstance.post<HRDocument>('/documents', data);
    return response.data;
  },

  addVersion: async (id: string, fileUrl: string) => {
    const response = await axiosInstance.post<HRDocument>(`/documents/${id}/versions`, { fileUrl });
    return response.data;
  },

  downloadDocument: async (id: string) => {
    const response = await axiosInstance.get<{
      name: string;
      fileUrl: string;
      category: string;
      version: number;
    }>(`/documents/${id}/download`);
    return response.data;
  },
};
