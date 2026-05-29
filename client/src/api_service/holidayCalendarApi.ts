import { axiosInstance } from './axiosInstance';

export interface Holiday {
  _id: string;
  name: string;
  date: string; // YYYY-MM-DD
  isRestricted: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoogleHoliday {
  name: string;
  date: string;
  isRestricted: boolean;
  isImported: boolean;
  databaseId: string | null;
}

export const holidayCalendarApi = {
  getAll: async (year?: number): Promise<Holiday[]> => {
    const params = year ? { year } : {};
    const response = await axiosInstance.get<{ holidays: Holiday[] }>('/holiday-calendar', { params });
    return response.data.holidays;
  },

  getGoogleHolidays: async (year?: number): Promise<GoogleHoliday[]> => {
    const params = year ? { year } : {};
    const response = await axiosInstance.get<{ holidays: GoogleHoliday[] }>('/holiday-calendar/google', { params });
    return response.data.holidays;
  },

  create: async (data: { name: string; date: string; isRestricted?: boolean }): Promise<Holiday> => {
    const response = await axiosInstance.post<{ holiday: Holiday }>('/holiday-calendar', data);
    return response.data.holiday;
  },

  update: async (id: string, data: Partial<{ name: string; date: string; isRestricted: boolean }>): Promise<Holiday> => {
    const response = await axiosInstance.put<{ holiday: Holiday }>(`/holiday-calendar/${id}`, data);
    return response.data.holiday;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/holiday-calendar/${id}`);
  },
};

