import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { propertyMediaApi } from '../api/propertyMedia';
import type { LocalMediaFile } from '../types';

// Query keys
export const propertyMediaKeys = {
  all: ['propertyMedia'] as const,
  byProperty: (propertyId: string) =>
    ['propertyMedia', 'property', propertyId] as const,
};

// Get media for a property
export const usePropertyMedia = (propertyId: string) => {
  return useQuery({
    queryKey: propertyMediaKeys.byProperty(propertyId),
    queryFn: () => propertyMediaApi.getByProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Upload media for a property
export const useUploadPropertyMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      file,
    }: {
      propertyId: string;
      file: LocalMediaFile;
    }) => propertyMediaApi.upload(propertyId, file),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: propertyMediaKeys.byProperty(propertyId),
      });
    },
  });
};

// Delete media
export const useDeletePropertyMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ mediaId }: { mediaId: string; propertyId: string }) =>
      propertyMediaApi.delete(mediaId),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: propertyMediaKeys.byProperty(propertyId),
      });
    },
  });
};
