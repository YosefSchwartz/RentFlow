import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api/user';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
};

// Get user dashboard data
export const useDashboard = () => {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: userApi.getDashboard,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to invalidate dashboard data
export const useInvalidateDashboard = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  };
};
