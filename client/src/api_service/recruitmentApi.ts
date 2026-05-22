import axiosInstance from './axiosInstance';
import type { Candidate, RecruitmentStage } from '../types';

export const recruitmentApi = {
  getAll: async (): Promise<Candidate[]> => {
    const res = await axiosInstance.get('/recruitment');
    return res.data.candidates;
  },

  create: async (data: Partial<Candidate>): Promise<Candidate> => {
    const res = await axiosInstance.post('/recruitment', data);
    return res.data.candidate;
  },

  updateStage: async (id: string, stage: RecruitmentStage): Promise<Candidate> => {
    const res = await axiosInstance.put(`/recruitment/${id}/stage`, { stage });
    return res.data.candidate;
  },

  update: async (id: string, data: Partial<Candidate>): Promise<Candidate> => {
    const res = await axiosInstance.put(`/recruitment/${id}`, data);
    return res.data.candidate;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/recruitment/${id}`);
  }
};
