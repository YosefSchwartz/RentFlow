import apiClient from './client';
import type { Notification, UnreadCountResponse, MarkAllReadResponse } from '../types';

export const notificationsApi = {
  // Get all notifications for current user
  getAll: async (): Promise<Notification[]> => {
    const response = await apiClient.get<Notification[]>('/notifications');
    return response.data;
  },

  // Get unread notifications count
  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data.count;
  },

  // Mark a single notification as read
  markAsRead: async (id: string): Promise<Notification> => {
    const response = await apiClient.patch<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  // Mark all notifications as read
  markAllAsRead: async (): Promise<number> => {
    const response = await apiClient.patch<MarkAllReadResponse>('/notifications/read-all');
    return response.data.markedAsRead;
  },
};
