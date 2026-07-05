import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leasesApi } from '../api/leases';
import type { CreateLeaseRequest } from '../types';

// Query keys
export const leaseKeys = {
  all: ['leases'] as const,
  my: ['leases', 'my'] as const,
  detail: (id: string) => ['leases', id] as const,
  byProperty: (propertyId: string) => ['leases', 'property', propertyId] as const,
};

// Get all leases for current user (as tenant)
export const useMyLeases = () => {
  return useQuery({
    queryKey: leaseKeys.my,
    queryFn: leasesApi.getMyLeases,
  });
};

// Get single lease by ID
export const useLease = (id: string) => {
  return useQuery({
    queryKey: leaseKeys.detail(id),
    queryFn: () => leasesApi.getById(id),
    enabled: !!id,
  });
};

// Get leases for a specific property (landlord view)
export const usePropertyLeases = (propertyId: string) => {
  return useQuery({
    queryKey: leaseKeys.byProperty(propertyId),
    queryFn: () => leasesApi.getByProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Create a new lease (landlord) — returns the lease incl. its activation code
export const useCreateLease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateLeaseRequest) => leasesApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
      queryClient.invalidateQueries({
        queryKey: leaseKeys.byProperty(variables.propertyId),
      });
    },
  });
};

// Tenant redeems a lease activation code to connect to the lease
export const useRedeemLease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => leasesApi.redeem(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// Landlord regenerates the activation code for an unassigned lease
export const useRegenerateLeaseCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.regenerateCode(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.detail(data.id) });
      queryClient.invalidateQueries({
        queryKey: leaseKeys.byProperty(data.propertyId),
      });
    },
  });
};

// Terminate a lease
export const useTerminateLease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leasesApi.terminate(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: leaseKeys.all });
      queryClient.invalidateQueries({ queryKey: leaseKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: leaseKeys.byProperty(data.propertyId) });
    },
  });
};
