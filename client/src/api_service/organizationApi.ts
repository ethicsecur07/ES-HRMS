import { axiosInstance } from './axiosInstance';

export interface Branch {
  _id: string;
  name: string;
  code: string;
  address?: string;
  timezone?: string;
  isActive: boolean;
}

export interface Division {
  _id: string;
  name: string;
  code: string;
  branchId: any; // Branch object or ID
  isActive: boolean;
}

export interface BusinessUnit {
  _id: string;
  name: string;
  code: string;
  divisionId: any; // Division object or ID
  isActive: boolean;
}

export interface CostCenter {
  _id: string;
  name: string;
  code: string;
  budgetLimit?: number;
  isActive: boolean;
}


export interface OrgStructureData {
  branches: Branch[];
  divisions: Division[];
  businessUnits: BusinessUnit[];
  costCenters: CostCenter[];
}

export const organizationApi = {
  getStructure: async () => {
    const res = await axiosInstance.get<OrgStructureData>('/organization');
    return res.data;
  },

  // Branch
  createBranch: async (data: Omit<Branch, '_id' | 'isActive'>) => {
    const res = await axiosInstance.post<Branch>('/organization/branch', data);
    return res.data;
  },
  updateBranch: async (id: string, data: Partial<Branch>) => {
    const res = await axiosInstance.put<Branch>(`/organization/branch/${id}`, data);
    return res.data;
  },
  deleteBranch: async (id: string) => {
    const res = await axiosInstance.delete<{ message: string }>(`/organization/branch/${id}`);
    return res.data;
  },

  // Division
  createDivision: async (data: { name: string; code: string; branchId: string }) => {
    const res = await axiosInstance.post<Division>('/organization/division', data);
    return res.data;
  },
  updateDivision: async (id: string, data: Partial<Division>) => {
    const res = await axiosInstance.put<Division>(`/organization/division/${id}`, data);
    return res.data;
  },
  deleteDivision: async (id: string) => {
    const res = await axiosInstance.delete<{ message: string }>(`/organization/division/${id}`);
    return res.data;
  },

  // Business Unit
  createBusinessUnit: async (data: { name: string; code: string; divisionId: string }) => {
    const res = await axiosInstance.post<BusinessUnit>('/organization/business-unit', data);
    return res.data;
  },
  updateBusinessUnit: async (id: string, data: Partial<BusinessUnit>) => {
    const res = await axiosInstance.put<BusinessUnit>(`/organization/business-unit/${id}`, data);
    return res.data;
  },
  deleteBusinessUnit: async (id: string) => {
    const res = await axiosInstance.delete<{ message: string }>(`/organization/business-unit/${id}`);
    return res.data;
  },

  // Cost Center
  createCostCenter: async (data: { name: string; code: string; budgetLimit?: number }) => {
    const res = await axiosInstance.post<CostCenter>('/organization/cost-center', data);
    return res.data;
  },
  updateCostCenter: async (id: string, data: Partial<CostCenter>) => {
    const res = await axiosInstance.put<CostCenter>(`/organization/cost-center/${id}`, data);
    return res.data;
  },
  deleteCostCenter: async (id: string) => {
    const res = await axiosInstance.delete<{ message: string }>(`/organization/cost-center/${id}`);
    return res.data;
  },
};

