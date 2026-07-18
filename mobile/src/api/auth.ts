import axios from 'axios';
import apiClient from './client';
import type { LoginRequest, RegisterRequest, User } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// Returned by register() — no session yet, the account still needs email
// verification.
export interface RegisterResponse {
  email: string;
  message: string;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const response = await apiClient.post<RegisterResponse>('/auth/register', data);
    return response.data;
  },

  verifyEmail: async (data: { email: string; code: string }): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/verify-email', data);
    return response.data;
  },

  resendOtp: async (data: { email: string }): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/resend-otp', data);
    return response.data;
  },

  forgotPassword: async (data: { email: string }): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/reset-password', data);
    return response.data;
  },

  // Refresh tokens - uses raw axios to avoid interceptor loops
  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const response = await axios.post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refreshToken });
  },

  logoutAll: async (): Promise<void> => {
    await apiClient.post('/auth/logout-all');
  },
};
