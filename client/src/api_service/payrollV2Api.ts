import { axiosInstance } from './axiosInstance';

export interface PayrollRun {
  _id: string;
  organizationId: string;
  runCycle: string; // YYYY-MM
  status: 'DRAFT' | 'LOCKED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  totalProcessedCount: number;
  totalPayoutAmount: number;
  processingLog: string[];
  createdAt: string;
}

export const payrollV2Api = {
  getRuns: async () => {
    const response = await axiosInstance.get<PayrollRun[]>('/v2/payroll/runs');
    return response.data;
  },

  triggerRun: async ({ startCycle, endCycle }: { startCycle: string; endCycle: string }) => {
    const response = await axiosInstance.post<{ message: string; run: PayrollRun; runs: PayrollRun[] }>('/v2/payroll/runs/trigger', { 
      startCycle, 
      endCycle 
    });
    return response.data;
  },

  rollbackRun: async (runCycle: string) => {
    const response = await axiosInstance.post<{ message: string; run: PayrollRun }>(`/v2/payroll/runs/${runCycle}/rollback`);
    return response.data;
  },

  exportJournal: async (runCycle: string, platform: 'XERO' | 'QUICKBOOKS' | 'SAGE') => {
    const response = await axiosInstance.post<{ message: string; data: any }>('/v2/payroll/runs/export', { runCycle, platform });
    return response.data;
  },
};
