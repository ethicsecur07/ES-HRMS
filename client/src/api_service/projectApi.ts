import axiosInstance from './axiosInstance';

const BASE_URL = '/projects';

export const projectApi = {
  // ─── Projects ───
  getProjects: async (params?: { status?: string; projectType?: string; priority?: string; search?: string; page?: number; limit?: number }) => {
    const res = await axiosInstance.get(BASE_URL, { params });
    return res.data;
  },
  createProject: async (data: any) => {
    const res = await axiosInstance.post(BASE_URL, data);
    return res.data;
  },
  getProjectDetails: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}`);
    return res.data;
  },
  updateProject: async (projectId: string, data: any) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}`, data);
    return res.data;
  },
  deleteProject: async (projectId: string) => {
    const res = await axiosInstance.delete(`${BASE_URL}/${projectId}`);
    return res.data;
  },

  // ─── Project Analytics ───
  getProjectAnalytics: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/analytics`);
    return res.data;
  },
  getTeamWorkload: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/team-workload`);
    return res.data;
  },
  getDashboardSummary: async () => {
    const res = await axiosInstance.get(`${BASE_URL}/dashboard/summary`);
    return res.data;
  },
  getEligibleEmployees: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/eligible-employees`);
    return res.data;
  },

  // ─── Project Activity ───
  getProjectActivity: async (projectId: string, params?: { page?: number; limit?: number }) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/activity`, { params });
    return res.data;
  },

  // ─── Sprints ───
  getSprints: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/sprints`);
    return res.data;
  },
  createSprint: async (projectId: string, data: any) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/sprints`, data);
    return res.data;
  },
  updateSprint: async (projectId: string, sprintId: string, data: any) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}/sprints/${sprintId}`, data);
    return res.data;
  },

  // ─── Tasks (Kanban) ───
  getTasks: async (projectId: string, params?: { sprintId?: string; status?: string; priority?: string }) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/tasks`, { params });
    return res.data;
  },
  createTask: async (projectId: string, data: any) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks`, data);
    return res.data;
  },
  updateTaskStatus: async (projectId: string, taskId: string, status: string) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}/tasks/${taskId}/status`, { status });
    return res.data;
  },
  updateTask: async (projectId: string, taskId: string, data: any) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}/tasks/${taskId}`, data);
    return res.data;
  },
  deleteTask: async (projectId: string, taskId: string) => {
    const res = await axiosInstance.delete(`${BASE_URL}/${projectId}/tasks/${taskId}`);
    return res.data;
  },

  // ─── Task Workflow (Review / Rework) ───
  submitTaskForReview: async (
    projectId: string,
    taskId: string,
    data: { completionNotes: string; progressSummary: string; checklistConfirmed: boolean }
  ) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks/${taskId}/submit-review`, data);
    return res.data;
  },
  approveTask: async (projectId: string, taskId: string, data: { reviewNotes?: string }) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks/${taskId}/approve`, data);
    return res.data;
  },
  rejectTask: async (projectId: string, taskId: string, data: { reworkComment: string }) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks/${taskId}/reject`, data);
    return res.data;
  },

  // ─── Task Comments ───
  getTaskComments: async (projectId: string, taskId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/tasks/${taskId}/comments`);
    return res.data;
  },
  createComment: async (projectId: string, taskId: string, data: { content: string; attachments?: any[] }) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks/${taskId}/comments`, data);
    return res.data;
  },
  updateComment: async (projectId: string, taskId: string, commentId: string, data: { content: string }) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}/tasks/${taskId}/comments/${commentId}`, data);
    return res.data;
  },
  deleteComment: async (projectId: string, taskId: string, commentId: string) => {
    const res = await axiosInstance.delete(`${BASE_URL}/${projectId}/tasks/${taskId}/comments/${commentId}`);
    return res.data;
  },

  // ─── Task Activity Timeline ───
  getTaskActivity: async (projectId: string, taskId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/tasks/${taskId}/activity`);
    return res.data;
  },

  // ─── File Upload (task attachments) ───
  uploadTaskAttachment: async (projectId: string, taskId: string, formData: FormData) => {
    const res = await axiosInstance.post(
      `${BASE_URL}/${projectId}/tasks/${taskId}/attachments`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return res.data;
  },
};
