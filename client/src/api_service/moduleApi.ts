import { axiosInstance } from './axiosInstance.js';

export interface ModuleRouteData {
  moduleCode: string;
  routePath: string;
  displayName: string;
  order?: number;
}

export const moduleApi = {
  getEnabledModules: async (): Promise<string[]> => {
    const response = await axiosInstance.get('/modules/enabled');
    return response.data;
  },

  getModuleRoutes: async (): Promise<ModuleRouteData[]> => {
    const response = await axiosInstance.get('/modules/routes');
    return response.data;
  }
};
