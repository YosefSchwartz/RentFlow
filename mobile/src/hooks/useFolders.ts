import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi } from '../api/folders';

export const folderKeys = {
  all: ['folders'] as const,
  byProperty: (propertyId: string) =>
    ['folders', 'property', propertyId] as const,
};

// Folder tree for a property
export const usePropertyFolders = (propertyId: string) => {
  return useQuery({
    queryKey: folderKeys.byProperty(propertyId),
    queryFn: () => foldersApi.getByProperty(propertyId),
    enabled: !!propertyId,
  });
};

// Create a folder
export const useCreateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      name,
      parentId,
    }: {
      propertyId: string;
      name: string;
      parentId?: string | null;
    }) => foldersApi.create(propertyId, { name, parentId }),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: folderKeys.byProperty(propertyId),
      });
    },
  });
};

// Rename / re-parent a folder
export const useUpdateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      folderId,
      data,
    }: {
      folderId: string;
      data: { name?: string; parentId?: string | null };
      propertyId: string;
    }) => foldersApi.update(folderId, data),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: folderKeys.byProperty(propertyId),
      });
    },
  });
};

// Delete a (non-system) folder
export const useDeleteFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      folderId,
    }: {
      folderId: string;
      propertyId: string;
    }) => foldersApi.delete(folderId),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({
        queryKey: folderKeys.byProperty(propertyId),
      });
    },
  });
};
