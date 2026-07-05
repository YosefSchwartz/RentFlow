import apiClient from './client';
import type { Document, DocumentCategory, DocumentVisibility } from '../types';

export const documentsApi = {
  // Get all documents for a property
  getByProperty: async (propertyId: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(
      `/properties/${propertyId}/documents`
    );
    return response.data;
  },

  // Get all documents for a lease
  getByLease: async (leaseId: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(
      `/leases/${leaseId}/documents`
    );
    return response.data;
  },

  // Get single document
  getById: async (documentId: string): Promise<Document> => {
    const response = await apiClient.get<Document>(`/documents/${documentId}`);
    return response.data;
  },

  // Upload document for property (multipart form data)
  uploadForProperty: async (
    propertyId: string,
    file: { uri: string; name: string; type: string },
    category: DocumentCategory,
    documentName?: string,
    visibility?: DocumentVisibility
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('name', documentName || file.name);
    formData.append('category', category);
    if (visibility) {
      formData.append('visibility', visibility);
    }

    const response = await apiClient.post<Document>(
      `/properties/${propertyId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Required documents across a property's leases (landlord only)
  getRequiredForProperty: async (propertyId: string): Promise<Document[]> => {
    const response = await apiClient.get<Document[]>(
      `/properties/${propertyId}/required-documents`
    );
    return response.data;
  },

  // Landlord requests a document from a tenant (no file yet)
  request: async (
    leaseId: string,
    data: { name: string; category: DocumentCategory }
  ): Promise<Document> => {
    const response = await apiClient.post<Document>(
      `/leases/${leaseId}/documents/request`,
      data
    );
    return response.data;
  },

  // Tenant uploads a file to fulfill a requested document (multipart)
  fulfill: async (
    documentId: string,
    file: { uri: string; name: string; type: string }
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post<Document>(
      `/documents/${documentId}/fulfill`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Update document (rename, change category)
  update: async (
    documentId: string,
    data: { name?: string; category?: DocumentCategory }
  ): Promise<Document> => {
    const response = await apiClient.patch<Document>(
      `/documents/${documentId}`,
      data
    );
    return response.data;
  },

  // Upload document for lease (multipart form data)
  uploadForLease: async (
    leaseId: string,
    file: { uri: string; name: string; type: string },
    category: DocumentCategory
  ): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    formData.append('name', file.name);
    formData.append('category', category);

    const response = await apiClient.post<Document>(
      `/leases/${leaseId}/documents/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Delete document
  delete: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/documents/${documentId}`);
  },
};
