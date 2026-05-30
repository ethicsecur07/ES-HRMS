import axiosInstance from './axiosInstance';

export interface MeetingAttendee {
  name: string;
  email: string;
  role?: string;
}

export interface CreateMeetingPayload {
  title: string;
  meetingType: 'INTERVIEW' | 'CLIENT' | 'TEAM';
  startDateTime: string;
  endDateTime: string;
  attendees: MeetingAttendee[];
  candidateId?: string;
  projectId?: string;
  notes?: string;
}

export interface ScheduleInterviewPayload {
  date: string;
  interviewer: string;
  interviewerEmail?: string;
  duration?: number;
  notes?: string;
  attendees?: MeetingAttendee[];
}

export const meetingApi = {
  // General meetings CRUD
  getAll: async (params?: {
    meetingType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => {
    const res = await axiosInstance.get('/meetings', { params });
    return res.data;
  },

  getById: async (id: string) => {
    const res = await axiosInstance.get(`/meetings/${id}`);
    return res.data;
  },

  create: async (data: CreateMeetingPayload) => {
    const res = await axiosInstance.post('/meetings', data);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateMeetingPayload>) => {
    const res = await axiosInstance.put(`/meetings/${id}`, data);
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await axiosInstance.delete(`/meetings/${id}`);
    return res.data;
  },

  // Recruitment-specific: schedule interview for a candidate
  scheduleInterview: async (candidateId: string, data: ScheduleInterviewPayload) => {
    const res = await axiosInstance.post(`/recruitment/${candidateId}/schedule-interview`, data);
    return res.data;
  },
};
