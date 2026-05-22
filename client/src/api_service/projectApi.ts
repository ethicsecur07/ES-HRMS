import axiosInstance from './axiosInstance';

const BASE_URL = '/projects';

export const projectApi = {
  getProjects: async () => {
    const res = await axiosInstance.get(BASE_URL);
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
  
  // Sprints
  getSprints: async (projectId: string) => {
    const res = await axiosInstance.get(`${BASE_URL}/${projectId}/sprints`);
    return res.data;
  },
  createSprint: async (projectId: string, data: any) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/sprints`, data);
    return res.data;
  },

  // Tasks
  getTasks: async (projectId: string, sprintId?: string) => {
    const url = sprintId 
      ? `${BASE_URL}/${projectId}/tasks?sprintId=${sprintId}`
      : `${BASE_URL}/${projectId}/tasks`;
    const res = await axiosInstance.get(url);
    return res.data;
  },
  createTask: async (projectId: string, data: any) => {
    const res = await axiosInstance.post(`${BASE_URL}/${projectId}/tasks`, data);
    return res.data;
  },
  updateTaskStatus: async (projectId: string, taskId: string, status: string) => {
    const res = await axiosInstance.put(`${BASE_URL}/${projectId}/tasks/${taskId}/status`, { status });
    return res.data;
  }
};
