import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { maintenanceApi } from '../api/maintenance';
import { notificationKeys } from './useNotifications';
import type {
  CreateMaintenanceRequest,
  MaintenanceStatus,
  LocalMediaFile,
} from '../types';

// Query keys
export const maintenanceKeys = {
  all: ['maintenance'] as const,
  byProperty: (propertyId: string) => ['maintenance', 'property', propertyId] as const,
  detail: (id: string) => ['maintenance', id] as const,
  comments: (id: string) => ['maintenance', id, 'comments'] as const,
  attachments: (id: string) => ['maintenance', id, 'attachments'] as const,
  receipts: (id: string) => ['maintenance', id, 'receipts'] as const,
  myRequests: ['maintenance', 'my-requests'] as const,
};

// Get maintenance requests for a property
export const usePropertyMaintenance = (propertyId: string) => {
  return useQuery({
    queryKey: maintenanceKeys.byProperty(propertyId),
    queryFn: () => maintenanceApi.getByProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Get single maintenance request
export const useMaintenanceRequest = (id: string) => {
  return useQuery({
    queryKey: maintenanceKeys.detail(id),
    queryFn: () => maintenanceApi.getById(id),
    enabled: !!id,
  });
};

// Get tenant's maintenance requests
export const useMyMaintenanceRequests = () => {
  return useQuery({
    queryKey: maintenanceKeys.myRequests,
    queryFn: maintenanceApi.getMyRequests,
  });
};

// Create maintenance request
export const useCreateMaintenanceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMaintenanceRequest) => maintenanceApi.create(data),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.byProperty(propertyId) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.myRequests });
    },
  });
};

// Update maintenance request status
export const useUpdateMaintenanceStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: MaintenanceStatus;
    }) => maintenanceApi.updateStatus(requestId, status),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.byProperty(result.propertyId),
      });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(result.id) });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.myRequests });
    },
  });
};

// Get the comment thread for a request
export const useMaintenanceComments = (requestId: string) => {
  return useQuery({
    queryKey: maintenanceKeys.comments(requestId),
    queryFn: () => maintenanceApi.getComments(requestId),
    enabled: !!requestId,
  });
};

// Mark a request's conversation as read (clears its notifications server-side)
export const useMarkConversationRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) =>
      maintenanceApi.markConversationRead(requestId),
    onSuccess: (result) => {
      // Only refresh the badge/list if something actually changed.
      if (result.markedAsRead > 0) {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
      }
    },
  });
};

// Add a comment to a request — text, an attachment, or both.
export const useAddMaintenanceComment = (requestId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, attachmentId }: { body?: string; attachmentId?: string }) =>
      maintenanceApi.addComment(requestId, body, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.comments(requestId) });
      // A newly-linked attachment moves out of the "general evidence" list.
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.attachments(requestId) });
    },
  });
};

// Get attachments for a request
export const useMaintenanceAttachments = (requestId: string) => {
  return useQuery({
    queryKey: maintenanceKeys.attachments(requestId),
    queryFn: () => maintenanceApi.getAttachments(requestId),
    enabled: !!requestId,
  });
};

// Upload a single attachment to a request
export const useUploadMaintenanceAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      file,
    }: {
      requestId: string;
      file: LocalMediaFile;
    }) => maintenanceApi.uploadAttachment(requestId, file),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.attachments(requestId),
      });
    },
  });
};

// Delete an attachment
export const useDeleteMaintenanceAttachment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ attachmentId }: { attachmentId: string; requestId: string }) =>
      maintenanceApi.deleteAttachment(attachmentId),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.attachments(requestId),
      });
    },
  });
};

// Get receipts for a request (only meaningful once RESOLVED, but the query
// itself works regardless — the mobile UI gates the section by status)
export const useMaintenanceReceipts = (requestId: string) => {
  return useQuery({
    queryKey: maintenanceKeys.receipts(requestId),
    queryFn: () => maintenanceApi.getReceipts(requestId),
    enabled: !!requestId,
  });
};

// Upload a receipt to a RESOLVED request (landlord or tenant)
export const useUploadMaintenanceReceipt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      file,
      name,
    }: {
      requestId: string;
      file: LocalMediaFile;
      name: string;
    }) => maintenanceApi.uploadReceipt(requestId, file, name),
    onSuccess: (_, { requestId }) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.receipts(requestId),
      });
    },
  });
};

// Delete maintenance request
export const useDeleteMaintenanceRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => maintenanceApi.delete(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.myRequests });
    },
  });
};
