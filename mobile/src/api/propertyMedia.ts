import apiClient from './client';
import type { PropertyMedia, LocalMediaFile } from '../types';

export const propertyMediaApi = {
  // Get all media for a property (owner or active tenant)
  getByProperty: async (propertyId: string): Promise<PropertyMedia[]> => {
    const response = await apiClient.get<PropertyMedia[]>(
      `/properties/${propertyId}/media`
    );
    return response.data;
  },

  // Upload a media file for a property (owner only — multipart form data)
  upload: async (
    propertyId: string,
    file: LocalMediaFile
  ): Promise<PropertyMedia> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);

    const response = await apiClient.post<PropertyMedia>(
      `/properties/${propertyId}/media/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Videos can be large; allow more time than the default.
        timeout: 60000,
      }
    );
    return response.data;
  },

  // Delete a media item (owner only)
  delete: async (mediaId: string): Promise<void> => {
    await apiClient.delete(`/media/${mediaId}`);
  },
};
