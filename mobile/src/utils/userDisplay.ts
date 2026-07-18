import type { User } from '../types';

export const getInitials = (user: User | null | undefined): string => {
  if (!user) return '?';
  return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
};
