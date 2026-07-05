import apiClient from './client';
import type {
  Property,
  CreatePropertyRequest,
  UpdatePropertyRequest,
} from '../types';

interface PropertiesResponse {
  owned: Property[];
  rented: Property[];
}

export const propertiesApi = {
  // Get all properties (owned by landlord)
  getAll: async (): Promise<Property[]> => {
    const response = await apiClient.get<PropertiesResponse>('/properties');
    return response.data.owned;
  },

  // Get single property
  getById: async (id: string): Promise<Property> => {
    const response = await apiClient.get<Property>(`/properties/${id}`);
    return response.data;
  },

  // Create property (landlord only)
  create: async (data: CreatePropertyRequest): Promise<Property> => {
    const response = await apiClient.post<Property>('/properties', data);
    return response.data;
  },

  // Update property
  update: async (id: string, data: UpdatePropertyRequest): Promise<Property> => {
    const response = await apiClient.patch<Property>(`/properties/${id}`, data);
    return response.data;
  },

  // Delete property
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/properties/${id}`);
  },
};
