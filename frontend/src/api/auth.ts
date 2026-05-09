import api from './client';
import type { LoginResponse, RegisterResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: handleError(error),
    };
  }
};

export const register = async (
  username: string,
  email: string,
  password: string,
): Promise<RegisterResponse> => {
  try {
    const response = await api.post('/auth/register', { username, email, password });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: handleError(error),
    };
  }
};

export const logout = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};
