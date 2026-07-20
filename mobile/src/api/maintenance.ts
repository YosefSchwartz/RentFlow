import apiClient from './client';
import type {
  MaintenanceRequest,
  MaintenanceComment,
  MaintenanceAttachment,
  CreateMaintenanceRequest,
  MaintenanceStatus,
  LocalMediaFile,
  Document,
} from '../types';

export const maintenanceApi = {
  // Get all maintenance requests for a property
  getByProperty: async (propertyId: string): Promise<MaintenanceRequest[]> => {
    const response = await apiClient.get<MaintenanceRequest[]>(
      `/properties/${propertyId}/requests`
    );
    return response.data;
  },

  // Get the current user's own requests (across all properties)
  getMyRequests: async (): Promise<MaintenanceRequest[]> => {
    const response = await apiClient.get<MaintenanceRequest[]>('/me/requests');
    return response.data;
  },

  // Get the comment thread for a request
  getComments: async (requestId: string): Promise<MaintenanceComment[]> => {
    const response = await apiClient.get<MaintenanceComment[]>(
      `/requests/${requestId}/comments`
    );
    return response.data;
  },

  // Add a comment to a request — text, an attachment, or both.
  addComment: async (
    requestId: string,
    body?: string,
    attachmentId?: string
  ): Promise<MaintenanceComment> => {
    const response = await apiClient.post<MaintenanceComment>(
      `/requests/${requestId}/comments`,
      { body, attachmentId }
    );
    return response.data;
  },

  // Mark a request's conversation as read (records view time + clears its
  // notifications). Called when the user opens the conversation.
  markConversationRead: async (
    requestId: string
  ): Promise<{ markedAsRead: number }> => {
    const response = await apiClient.post<{ markedAsRead: number }>(
      `/requests/${requestId}/read`
    );
    return response.data;
  },

  // Get single maintenance request
  getById: async (requestId: string): Promise<MaintenanceRequest> => {
    const response = await apiClient.get<MaintenanceRequest>(
      `/requests/${requestId}`
    );
    return response.data;
  },

  // Create maintenance request (tenant only)
  create: async (data: CreateMaintenanceRequest): Promise<MaintenanceRequest> => {
    const { propertyId, ...rest } = data;
    const response = await apiClient.post<MaintenanceRequest>(
      `/properties/${propertyId}/requests`,
      rest
    );
    return response.data;
  },

  // Update maintenance request status (landlord only)
  updateStatus: async (
    requestId: string,
    status: MaintenanceStatus
  ): Promise<MaintenanceRequest> => {
    const response = await apiClient.patch<MaintenanceRequest>(
      `/requests/${requestId}`,
      { status }
    );
    return response.data;
  },

  // Delete maintenance request
  delete: async (requestId: string): Promise<void> => {
    await apiClient.delete(`/requests/${requestId}`);
  },

  // Get attachments for a request (owner or tenant)
  getAttachments: async (
    requestId: string
  ): Promise<MaintenanceAttachment[]> => {
    const response = await apiClient.get<MaintenanceAttachment[]>(
      `/requests/${requestId}/attachments`
    );
    return response.data;
  },

  // Upload an attachment for a request (multipart form data)
  uploadAttachment: async (
    requestId: string,
    file: LocalMediaFile
  ): Promise<MaintenanceAttachment> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post<MaintenanceAttachment>(
      `/requests/${requestId}/attachments/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
    return response.data;
  },

  // Delete an attachment (uploader or owner)
  deleteAttachment: async (attachmentId: string): Promise<void> => {
    await apiClient.delete(`/attachments/${attachmentId}`);
  },

  // Get receipts for a request (participant only; request must be RESOLVED
  // for uploads, but existing receipts remain visible regardless of status)
  getReceipts: async (requestId: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(
      `/requests/${requestId}/receipts`
    );
    return response.data;
  },

  // Upload a receipt (multipart form data) — only while the request is RESOLVED.
  uploadReceipt: async (
    requestId: string,
    file: LocalMediaFile,
    name: string
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('name', name);

    const response = await apiClient.post<Document>(
      `/requests/${requestId}/receipts/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
    return response.data;
  },
};
