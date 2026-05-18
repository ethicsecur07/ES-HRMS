import { axiosInstance } from './axiosInstance';

export interface FinanceRecord {
  _id: string;
  type: 'ALLOCATION' | 'EXPENSE';
  amount: number;
  categoryOrReason: string;
  description?: string;
  date: string;
  loggedBy: string;
  createdAt: string;
}

export interface FinanceSummaryResponse {
  summary: {
    totalAllocated: number;
    totalSpent: number;
    remainingBalance: number;
  };
  records: FinanceRecord[];
}

export const financeApi = {
  getSummary: async () => {
    const response = await axiosInstance.get<FinanceSummaryResponse>('/finance');
    return response.data;
  },

  addRecord: async (data: { type: 'ALLOCATION' | 'EXPENSE'; amount: number; categoryOrReason: string; description?: string; date: string }) => {
    const response = await axiosInstance.post<{ record: FinanceRecord }>('/finance', data);
    return response.data.record;
  },
};
