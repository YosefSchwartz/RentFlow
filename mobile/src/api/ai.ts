import apiClient from './client';
import type { DocumentAi, DocumentCategory } from '../types';

export const aiApi = {
  // AI status + summary + prediction + approved category + extracted fields.
  getForDocument: async (documentId: string): Promise<DocumentAi> => {
    const response = await apiClient.get<DocumentAi>(
      `/documents/${documentId}/ai`
    );
    return response.data;
  },

  // Manual retry — enqueues a fresh analysis job.
  retry: async (documentId: string): Promise<void> => {
    await apiClient.post(`/documents/${documentId}/ai/retry`);
  },

  // The user's category decision becomes official; the prediction is retained.
  setCategory: async (
    documentId: string,
    category: DocumentCategory
  ): Promise<DocumentAi> => {
    const response = await apiClient.post<DocumentAi>(
      `/documents/${documentId}/ai/category`,
      { category }
    );
    return response.data;
  },
};
