import { axiosInstance } from './axiosInstance';

export interface LeavePolicy {
  _id: string;
  leaveType: string;
  monthlyAllowance: number;
  carryForward: boolean;
  carryForwardLimit: number;
  sandwichLeaveRule: boolean;
  holidayOverlapRule: boolean;
  compensatoryOffEligibility: { canEarn: boolean; validityDays: number };
  encashmentRule: { canEncash: boolean; maxEncashableDays: number; encashmentRatePercentage: number };
  latePenaltyCount: number;
  permissionConversionHours: number;
  halfDayEnabled: boolean;
  advanceNoticeDays: number;
  maxConsecutiveDays: number;
  applicableGender: 'All' | 'Male' | 'Female';
  probationExempt: boolean;
  permissionAutoConvert: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalanceSummary {
  leaveType: string;
  allocated: number;
  used: number;
  balance: number;
  halfDayEnabled?: boolean;
  carryForward?: boolean;
  monthlyAllowance?: number;
  permissionConversionHours?: number;
}

export const leavePolicyApi = {
  getAll: async (): Promise<LeavePolicy[]> => {
    const response = await axiosInstance.get<{ policies: LeavePolicy[] }>('/leave-policies');
    return response.data.policies;
  },

  create: async (data: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const response = await axiosInstance.post<{ policy: LeavePolicy }>('/leave-policies', data);
    return response.data.policy;
  },

  update: async (id: string, data: Partial<LeavePolicy>): Promise<LeavePolicy> => {
    const response = await axiosInstance.put<{ policy: LeavePolicy }>(`/leave-policies/${id}`, data);
    return response.data.policy;
  },

  toggleStatus: async (id: string): Promise<LeavePolicy> => {
    const response = await axiosInstance.patch<{ policy: LeavePolicy }>(`/leave-policies/${id}/toggle`);
    return response.data.policy;
  },
};

export const leaveBalanceApi = {
  getMyBalances: async (): Promise<LeaveBalanceSummary[]> => {
    const response = await axiosInstance.get<{ balances: LeaveBalanceSummary[] }>('/v2/leave/balance/me');
    return response.data.balances;
  },

  getEmployeeBalances: async (empId: string): Promise<LeaveBalanceSummary[]> => {
    const response = await axiosInstance.get<{ balances: LeaveBalanceSummary[] }>(`/v2/leave/balance/${empId}`);
    return response.data.balances;
  },
};
