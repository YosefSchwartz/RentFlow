import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'keynest_access_token';
const REFRESH_TOKEN_KEY = 'keynest_refresh_token';
const USER_KEY = 'keynest_user';

// Store access token securely
export const storeAccessToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing access token:', error);
    throw error;
  }
};

// Get access token from secure storage
export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

// Store refresh token securely
export const storeRefreshToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error storing refresh token:', error);
    throw error;
  }
};

// Get refresh token from secure storage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

// Store both tokens at once
export const storeTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
  await Promise.all([
    storeAccessToken(accessToken),
    storeRefreshToken(refreshToken),
  ]);
};

// Clear all auth data (logout)
export const clearTokens = async (): Promise<void> => {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing tokens:', error);
    throw error;
  }
};

// Store user data (for quick access without API call)
export const storeUser = async (user: object): Promise<void> => {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error storing user:', error);
    throw error;
  }
};

// Get stored user data
export const getStoredUser = async (): Promise<object | null> => {
  try {
    const userString = await SecureStore.getItemAsync(USER_KEY);
    return userString ? JSON.parse(userString) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

// Check if user has refresh token (indicates potential valid session)
export const hasRefreshToken = async (): Promise<boolean> => {
  const token = await getRefreshToken();
  return !!token;
};

// Legacy compatibility - alias for getAccessToken
export const getToken = getAccessToken;

// Legacy compatibility - clears all tokens
export const clearToken = clearTokens;

// Legacy compatibility - stores access token
export const storeToken = storeAccessToken;

// Check if user is authenticated (has access token)
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await getAccessToken();
  return !!token;
};
