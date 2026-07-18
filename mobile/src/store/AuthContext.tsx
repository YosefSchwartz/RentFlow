import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import {
  storeTokens,
  clearTokens,
  getRefreshToken,
  storeUser,
  getStoredUser,
} from '../services/auth';
import { queryClient } from '../lib/queryClient';
import type { User, LoginRequest, RegisterRequest } from '../types';

export interface RegisterResult {
  requiresVerification: boolean;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<RegisterResult>;
  completeEmailVerification: (email: string, code: string) => Promise<void>;
  completePasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session restoration on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const refreshToken = await getRefreshToken();

        if (!refreshToken) {
          // No refresh token - user is not logged in
          setIsLoading(false);
          return;
        }

        // Try to get user from storage first for faster load
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser as User);
        }

        // Attempt to refresh the session
        try {
          const { accessToken, refreshToken: newRefreshToken } = await authApi.refresh(refreshToken);

          // Store new tokens
          await storeTokens(accessToken, newRefreshToken);

          // Fetch current user data
          const currentUser = await authApi.getMe();
          setUser(currentUser);
          await storeUser(currentUser);
        } catch {
          // Refresh failed - session expired, clear everything
          await clearTokens();
          setUser(null);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        await clearTokens();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Shared by login/register/completeEmailVerification — all three receive
  // the same {accessToken, refreshToken, user} shape and complete a session
  // identically.
  const applySession = useCallback(async (response: unknown) => {
    // Handle response - support both direct and nested formats
    const res = response as any;
    const accessToken = res.accessToken || res.access_token || res.token;
    const refreshToken = res.refreshToken || res.refresh_token;
    const userData = res.user || res;

    if (!accessToken || !refreshToken) {
      console.error('Auth response:', JSON.stringify(response));
      throw new Error('Invalid token response - missing tokens');
    }

    if (!userData || !userData.id) {
      console.error('Auth response:', JSON.stringify(response));
      throw new Error('Invalid token response - missing user data');
    }

    await storeTokens(accessToken, refreshToken);
    await storeUser(userData);
    setUser(userData);
  }, []);

  const login = useCallback(
    async (data: LoginRequest) => {
      const response = await authApi.login(data);
      await applySession(response);
    },
    [applySession],
  );

  const register = useCallback(
    async (data: RegisterRequest): Promise<RegisterResult> => {
      const response = await authApi.register(data);

      // The normal path: a brand-new account has no tokens yet — it still
      // needs to verify its email via VerifyEmailScreen.
      const res = response as any;
      const accessToken = res.accessToken || res.access_token || res.token;
      if (!accessToken) {
        return { requiresVerification: true, email: response.email };
      }

      // Defensive fallback only — kept in case a future/older backend still
      // auto-authenticates on register.
      await applySession(response);
      return { requiresVerification: false, email: response.email };
    },
    [applySession],
  );

  const completeEmailVerification = useCallback(
    async (email: string, code: string) => {
      const response = await authApi.verifyEmail({ email, code });
      await applySession(response);
    },
    [applySession],
  );

  const completePasswordReset = useCallback(
    async (email: string, code: string, newPassword: string) => {
      const response = await authApi.resetPassword({ email, code, newPassword });
      await applySession(response);
    },
    [applySession],
  );

  const updateUser = useCallback(async (updatedUser: User) => {
    setUser(updatedUser);
    await storeUser(updatedUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore logout API errors - still clear local state
    }
    await clearTokens();
    queryClient.clear(); // Clear all cached data
    setUser(null);
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch {
      // Ignore logout API errors - still clear local state
    }
    await clearTokens();
    queryClient.clear(); // Clear all cached data
    setUser(null);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    completeEmailVerification,
    completePasswordReset,
    updateUser,
    logout,
    logoutAll,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
