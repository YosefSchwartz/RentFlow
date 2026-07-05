import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import type { DocumentCategory, DocumentVisibility } from '../types';

// Query keys
export const documentKeys = {
  all: ['documents'] as const,
  byProperty: (propertyId: string) => ['documents', 'property', propertyId] as const,
  byLease: (leaseId: string) => ['documents', 'lease', leaseId] as const,
  required: (propertyId: string) =>
    ['documents', 'required', 'property', propertyId] as const,
  detail: (id: string) => ['documents', id] as const,
};

// Get documents for a property
export const usePropertyDocuments = (propertyId: string) => {
  return useQuery({
    queryKey: documentKeys.byProperty(propertyId),
    queryFn: () => documentsApi.getByProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Get documents for a lease
export const useLeaseDocuments = (leaseId: string) => {
  return useQuery({
    queryKey: documentKeys.byLease(leaseId),
    queryFn: () => documentsApi.getByLease(leaseId),
    enabled: !!leaseId,
  });
};

// Get single document
export const useDocument = (id: string) => {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsApi.getById(id),
    enabled: !!id,
  });
};

// Upload document for property
export const useUploadPropertyDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      file,
      category,
      name,
      visibility,
    }: {
      propertyId: string;
      file: { uri: string; name: string; type: string };
      category: DocumentCategory;
      name?: string;
      visibility?: DocumentVisibility;
    }) =>
      documentsApi.uploadForProperty(propertyId, file, category, name, visibility),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.byProperty(propertyId) });
    },
  });
};

// Required documents across a property's leases (landlord)
export const useRequiredDocuments = (propertyId: string) => {
  return useQuery({
    queryKey: documentKeys.required(propertyId),
    queryFn: () => documentsApi.getRequiredForProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Landlord requests a document from a tenant
export const useRequestDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaseId,
      name,
      category,
    }: {
      leaseId: string;
      propertyId: string;
      name: string;
      category: DocumentCategory;
    }) => documentsApi.request(leaseId, { name, category }),
    onSuccess: (_, { propertyId, leaseId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.required(propertyId) });
      queryClient.invalidateQueries({ queryKey: documentKeys.byLease(leaseId) });
    },
  });
};

// Tenant uploads a file to fulfill a requested document
export const useFulfillDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      file,
    }: {
      documentId: string;
      leaseId?: string;
      propertyId?: string;
      file: { uri: string; name: string; type: string };
    }) => documentsApi.fulfill(documentId, file),
    onSuccess: (_, { leaseId, propertyId }) => {
      if (leaseId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.byLease(leaseId) });
      }
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.required(propertyId) });
      }
    },
  });
};

// Upload document for lease
export const useUploadLeaseDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaseId,
      file,
      category,
    }: {
      leaseId: string;
      file: { uri: string; name: string; type: string };
      category: DocumentCategory;
    }) => documentsApi.uploadForLease(leaseId, file, category),
    onSuccess: (_, { leaseId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.byLease(leaseId) });
    },
  });
};

// Update document (rename, change category)
export const useUpdateDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      documentId,
      data,
    }: {
      documentId: string;
      data: { name?: string; category?: DocumentCategory };
      propertyId?: string;
    }) => documentsApi.update(documentId, data),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.byProperty(propertyId) });
      }
    },
  });
};

// Delete document
export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => documentsApi.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
};
