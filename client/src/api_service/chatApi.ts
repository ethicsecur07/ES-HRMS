import axiosInstance from './axiosInstance';
import type { ChatMessage } from '../types';

export const chatApi = {
  getConversation: async (otherUserId: string): Promise<ChatMessage[]> => {
    const res = await axiosInstance.get(`/chat/${otherUserId}`);
    return res.data.messages;
  },

  sendMessage: async (receiverId: string, content: string): Promise<ChatMessage> => {
    const res = await axiosInstance.post('/chat', { receiverId, content });
    // Server responds with { success: true, data: <message> }
    return res.data;
  },

  sendFile: async (receiverId: string, file: File): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiverId', receiverId);
    const res = await axiosInstance.post('/chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    // Server responds with { success: true, data: <message> }
    return res.data;
  },

  markRead: async (messageId: string): Promise<void> => {
    await axiosInstance.patch(`/chat/${messageId}/read`);
  },

  getRecentConversations: async (): Promise<any[]> => {
    const res = await axiosInstance.get('/chat/conversations/recent');
    return res.data.recentConversations || [];
  },
};
