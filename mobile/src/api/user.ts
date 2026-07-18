import apiClient from './client';
import type { DashboardResponse, User } from '../types';

export const userApi = {
  getDashboard: async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/me/dashboard');
    return response.data;
  },

  // Permanently delete the current account (requires the current password).
  deleteAccount: async (password: string): Promise<void> => {
    await apiClient.post('/users/me/delete', { password });
  },

  updateProfile: async (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
  }): Promise<User> => {
    const response = await apiClient.patch<User>('/users/me', data);
    return response.data;
  },

  // Multipart through the backend (mirrors documentsApi.uploadForProperty's
  // exact pattern) — not a presigned direct-to-S3 upload, since that's the
  // one upload convention already established on the mobile side.
  uploadAvatar: async (file: { uri: string; name: string; type: string }): Promise<User> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post<User>('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
