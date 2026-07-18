import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/user';
import { useAuth } from '../store/AuthContext';
import { dashboardKeys } from './useDashboard';
import type { LocalMediaFile } from '../types';

// Editing name/phone updates AuthContext (so ProfileScreen reflects it
// immediately) and invalidates the dashboard query — GET /me/dashboard embeds
// its own copy of `user` that would otherwise go stale.
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { updateUser } = useAuth();

  return useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; phone?: string }) =>
      userApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
};

export const useUploadAvatar = () => {
  const { updateUser } = useAuth();

  return useMutation({
    mutationFn: (file: LocalMediaFile) => userApi.uploadAvatar(file),
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
    },
  });
};
