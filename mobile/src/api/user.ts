import apiClient from './client';
import type { DashboardResponse } from '../types';

export const userApi = {
  getDashboard: async (): Promise<DashboardResponse> => {
    const response = await apiClient.get<DashboardResponse>('/me/dashboard');
    return response.data;
  },

  // Permanently delete the current account (requires the current password).
  deleteAccount: async (password: string): Promise<void> => {
    await apiClient.post('/users/me/delete', { password });
  },
};
