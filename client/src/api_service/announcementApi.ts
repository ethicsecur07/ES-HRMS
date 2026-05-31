import { axiosInstance } from './axiosInstance';

export interface AnnouncementItem {
  _id: string;
  organizationId: string;
  title: string;
  content: string;
  type: 'ANNOUNCEMENT' | 'POLICY_CHANGE';
  createdBy: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;
  updatedAt: string;
}

export const announcementApi = {
  create: async (data: { title: string; content: string; type?: 'ANNOUNCEMENT' | 'POLICY_CHANGE' }) => {
    const response = await axiosInstance.post<{ announcement: AnnouncementItem; message: string }>('/announcements', data);
    return response.data.announcement;
  },

  getAll: async () => {
    const response = await axiosInstance.get<{ announcements: AnnouncementItem[] }>('/announcements');
    return response.data.announcements;
  },

  delete: async (id: string) => {
    const response = await axiosInstance.delete<{ message: string }>(`/announcements/${id}`);
    return response.data;
  },
};
