import { axiosInstance } from './axiosInstance';
import type { ApprovalStatus } from '../types';

export interface ReimbursementClaim {
  _id: string;
  organizationId: string;
  employeeId: {
    _id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    department: string;
  } | string;
  expenseDate: string;
  amount: number;
  category: 'TRAVEL' | 'MEDICAL' | 'FOOD' | 'EQUIPMENT' | 'OTHER';
  description: string;
  receiptUrl?: string;
  status: ApprovalStatus;
  approvedBy?: {
    name: string;
    email: string;
  } | string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDeclaration {
  _id: string;
  organizationId: string;
  employeeId: {
    _id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    department: string;
  } | string;
  financialYear: string;
  declarationSection: '80C' | '80D' | 'HRA' | 'SECTION_24' | 'OTHER';
  declaredAmount: number;
  proofUrl?: string;
  status: ApprovalStatus;
  approvedBy?: {
    name: string;
    email: string;
  } | string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceCorrectionRequest {
  _id: string;
  organizationId: string;
  employeeId: {
    _id: string;
    fullName: string;
    employeeCode: string;
    email: string;
    department: string;
  } | string;
  attendanceDate: string; // YYYY-MM-DD
  requestedLoginTime: string;
  requestedLogoutTime: string;
  reason: string;
  status: ApprovalStatus;
  approvedBy?: {
    name: string;
    email: string;
  } | string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OcrData {
  amount?: number;
  date?: string;
  category?: string;
  description?: string;
  merchantName?: string;
}

export const selfServiceApi = {
  // --- Reimbursements ---
  getReimbursements: async (params?: { employeeId?: string; status?: string }) => {
    const response = await axiosInstance.get<ReimbursementClaim[]>('/self-service/reimbursements', { params });
    return response.data;
  },

  createReimbursement: async (data: {
    expenseDate: string;
    amount: number;
    category: string;
    description: string;
    receiptUrl?: string;
    employeeId?: string;
  }) => {
    const response = await axiosInstance.post<ReimbursementClaim>('/self-service/reimbursements', data);
    return response.data;
  },

  scanReceipt: async (receiptUrl: string) => {
    const response = await axiosInstance.post<OcrData>('/self-service/reimbursements/scan', { receiptUrl });
    return response.data;
  },

  approveReimbursement: async (id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const response = await axiosInstance.put<ReimbursementClaim>(`/self-service/reimbursements/${id}/approve`, {
      status,
      rejectionReason,
    });
    return response.data;
  },

  // --- Tax Declarations ---
  getTaxDeclarations: async (params?: { employeeId?: string; financialYear?: string }) => {
    const response = await axiosInstance.get<TaxDeclaration[]>('/self-service/tax-declarations', { params });
    return response.data;
  },

  createTaxDeclaration: async (data: {
    financialYear: string;
    declarationSection: string;
    declaredAmount: number;
    proofUrl?: string;
    employeeId?: string;
  }) => {
    const response = await axiosInstance.post<TaxDeclaration>('/self-service/tax-declarations', data);
    return response.data;
  },

  approveTaxDeclaration: async (id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const response = await axiosInstance.put<TaxDeclaration>(`/self-service/tax-declarations/${id}/approve`, {
      status,
      rejectionReason,
    });
    return response.data;
  },

  // --- Attendance Corrections ---
  getAttendanceCorrections: async (params?: { employeeId?: string; status?: string }) => {
    const response = await axiosInstance.get<AttendanceCorrectionRequest[]>('/self-service/attendance-corrections', { params });
    return response.data;
  },

  createAttendanceCorrection: async (data: {
    attendanceDate: string;
    requestedLoginTime: string;
    requestedLogoutTime: string;
    reason: string;
    employeeId?: string;
  }) => {
    const response = await axiosInstance.post<AttendanceCorrectionRequest>('/self-service/attendance-corrections', data);
    return response.data;
  },

  approveAttendanceCorrection: async (id: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    const response = await axiosInstance.put<AttendanceCorrectionRequest>(`/self-service/attendance-corrections/${id}/approve`, {
      status,
      rejectionReason,
    });
    return response.data;
  },
};
