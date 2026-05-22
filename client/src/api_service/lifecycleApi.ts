import { axiosInstance } from './axiosInstance';

export interface LifecycleStep {
  _id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  notes?: string;
  assignedTo?: any; // populated employee
  completedAt?: string;
}

export interface LifecycleTracker {
  _id: string;
  organizationId: string;
  employeeId: any; // populated employee object
  type: 'ONBOARDING' | 'PROBATION' | 'PROMOTION' | 'TRANSFER' | 'RESIGNATION' | 'EXIT';
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED';
  startDate: string;
  completionDate?: string;
  steps: LifecycleStep[];
  probationDetails?: {
    isConfirmed: boolean;
    reviewComments?: string;
  };
  promotionDetails?: {
    newRoleCode: string;
    newSalary: number;
    effectiveDate?: string;
  };
  transferDetails?: {
    newDepartment: string;
    newBranchId: string;
    effectiveDate?: string;
  };
  resignationDetails?: {
    lastWorkingDay: string;
    noticeServed: boolean;
    exitInterviewCompleted: boolean;
    reasonForLeaving?: string;
  };
}

export const lifecycleApi = {
  getAll: async (params?: { employeeId?: string; type?: string }) => {
    const res = await axiosInstance.get<LifecycleTracker[]>('/lifecycle', { params });
    return res.data;
  },

  createTracker: async (data: {
    employeeId: string;
    type: 'ONBOARDING' | 'PROBATION' | 'PROMOTION' | 'TRANSFER' | 'RESIGNATION' | 'EXIT';
    startDate?: string;
    probationDetails?: any;
    promotionDetails?: any;
    transferDetails?: any;
    resignationDetails?: any;
  }) => {
    const res = await axiosInstance.post<LifecycleTracker>('/lifecycle', data);
    return res.data;
  },

  updateStep: async (
    trackerId: string,
    stepId: string,
    data: {
      status?: 'COMPLETED' | 'SKIPPED' | 'PENDING';
      notes?: string;
      assignedTo?: string;
    }
  ) => {
    const res = await axiosInstance.put<LifecycleTracker>(`/lifecycle/${trackerId}/step/${stepId}`, data);
    return res.data;
  },

  updateDetails: async (id: string, data: Partial<LifecycleTracker>) => {
    const res = await axiosInstance.put<LifecycleTracker>(`/lifecycle/${id}`, data);
    return res.data;
  },
};
