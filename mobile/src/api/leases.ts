import apiClient from './client';
import type { Lease, CreateLeaseRequest } from '../types';

export const leasesApi = {
  // Get all leases for current user (as tenant)
  getMyLeases: async (): Promise<Lease[]> => {
    const response = await apiClient.get<Lease[]>('/leases/my');
    return response.data;
  },

  // Get single lease by ID
  getById: async (id: string): Promise<Lease> => {
    const response = await apiClient.get<Lease>(`/leases/${id}`);
    return response.data;
  },

  // Get leases for a specific property (landlord view)
  getByProperty: async (propertyId: string): Promise<Lease[]> => {
    const response = await apiClient.get<Lease[]>(`/properties/${propertyId}/leases`);
    return response.data;
  },

  // Create a new lease (landlord) - nested under the property. No tenant; the
  // response includes an activationCode the landlord shares.
  create: async (data: CreateLeaseRequest): Promise<Lease> => {
    const { propertyId, ...body } = data;
    const response = await apiClient.post<Lease>(
      `/properties/${propertyId}/leases`,
      body,
    );
    return response.data;
  },

  // Tenant redeems a lease activation code to connect to the lease.
  redeem: async (code: string): Promise<Lease> => {
    const response = await apiClient.post<Lease>('/leases/redeem', { code });
    return response.data;
  },

  // Landlord regenerates the activation code for an unassigned lease.
  regenerateCode: async (id: string): Promise<Lease> => {
    const response = await apiClient.post<Lease>(`/leases/${id}/activation-code`);
    return response.data;
  },

  // Terminate a lease (landlord) - backend exposes a generic status update
  terminate: async (id: string): Promise<Lease> => {
    const response = await apiClient.patch<Lease>(`/leases/${id}/status`, {
      status: 'TERMINATED',
    });
    return response.data;
  },
};
