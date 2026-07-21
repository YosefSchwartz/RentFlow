import apiClient from './client';
import type { Folder } from '../types';

export const foldersApi = {
  // Full folder tree for a property
  getByProperty: async (propertyId: string): Promise<Folder[]> => {
    const response = await apiClient.get<Folder[]>(
      `/properties/${propertyId}/folders`
    );
    return response.data;
  },

  // Create a folder (optionally nested under parentId)
  create: async (
    propertyId: string,
    data: { name: string; parentId?: string | null }
  ): Promise<Folder> => {
    const response = await apiClient.post<Folder>(
      `/properties/${propertyId}/folders`,
      data
    );
    return response.data;
  },

  // Rename / re-parent a folder
  update: async (
    folderId: string,
    data: { name?: string; parentId?: string | null }
  ): Promise<Folder> => {
    const response = await apiClient.patch<Folder>(
      `/folders/${folderId}`,
      data
    );
    return response.data;
  },

  // Delete a (non-system) folder
  delete: async (folderId: string): Promise<void> => {
    await apiClient.delete(`/folders/${folderId}`);
  },
};
