import { axiosInstance } from './axiosInstance';

export interface WorkflowTemplate {
  _id: string;
  code?: string;
  name: string;
  triggerEvent: string;
  nodes: Array<{ id: string; type: string; name: string; label?: string; config?: Record<string, any> }>;
  version?: number;
  isPublished?: boolean;
  isActive?: boolean;
  uiMetadata?: any;
}

export interface WorkflowInstance {
  _id: string;
  workflowTemplateId: string | { _id: string; name: string; triggerEvent?: string; version?: number };
  currentNodeId: string;
  status: 'ACTIVE' | 'APPROVED' | 'REJECTED' | 'TERMINATED';
  refModel: 'Leave' | 'WFHRequest' | 'Reimbursement';
  refId: string;
  organizationId: string;
  history?: Array<{ nodeId: string; nodeName: string; approverRole?: string; status: string; comments?: string; actionTakenAt?: string }>;
  createdAt: string;
  updatedAt?: string;
}

export const workflowApi = {
  getTemplates: async () => {
    const response = await axiosInstance.get<WorkflowTemplate[]>('/v2/workflows/templates');
    return response.data;
  },

  createTemplate: async (data: Pick<WorkflowTemplate, 'name' | 'triggerEvent' | 'nodes'>) => {
    const response = await axiosInstance.post<WorkflowTemplate>('/v2/workflows/templates', data);
    return response.data;
  },

  publishTemplate: async (id: string) => {
    const response = await axiosInstance.post<{ message: string; template: WorkflowTemplate }>(`/v2/workflows/templates/${id}/publish`);
    return response.data;
  },

  toggleTemplate: async (id: string, isActive: boolean) => {
    const response = await axiosInstance.post<{ message: string; template: WorkflowTemplate }>(`/v2/workflows/templates/${id}/toggle`, { isActive });
    return response.data;
  },

  createInstance: async (data: { workflowTemplateId: string; refModel: string; refId: string }) => {
    const response = await axiosInstance.post<WorkflowInstance>('/v2/workflows/instances', data);
    return response.data;
  },

  getInstances: async () => {
    const response = await axiosInstance.get<{ instances: WorkflowInstance[]; total: number }>('/v2/workflows/instances');
    return response.data;
  },

  getInstance: async (instanceId: string) => {
    const response = await axiosInstance.get<WorkflowInstance>(`/v2/workflows/instances/${instanceId}`);
    return response.data;
  },

  actOnNode: async (instanceId: string, action: 'APPROVE' | 'REJECT' | 'SKIP', comments?: string) => {
    const response = await axiosInstance.post<{ message: string }>(`/v2/workflows/instances/${instanceId}/actions`, { action, comments });
    return response.data;
  },

  getMarketplace: async () => {
    const response = await axiosInstance.get<WorkflowTemplate[]>('/v2/workflows/templates/marketplace');
    return response.data;
  },

  installMarketplaceTemplate: async (code: string) => {
    const response = await axiosInstance.post<{ message: string; template: WorkflowTemplate }>('/v2/workflows/templates/marketplace/install', { code });
    return response.data;
  },
};
