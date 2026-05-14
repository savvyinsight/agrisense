import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import type { User } from '@/shared/types/api';
import { useAuthStore } from '@/shared/stores/authStore';

type AuthContextType = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  loading: boolean;
  isAdmin: () => boolean;
  isViewer: () => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading, setAuth, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      const parsed = JSON.parse(userData) as User;
      useAuthStore.getState().setAuth(parsed, token);
    } else {
      setLoading(false);
    }
  }, [setLoading]);

  const setUser = (u: React.SetStateAction<User | null>) => {
    const resolved = typeof u === 'function' ? u(user) : u;
    if (resolved) {
      const token = localStorage.getItem('token') || '';
      setAuth(resolved, token);
    } else {
      clearAuth();
    }
  };

  const value: AuthContextType = {
    user,
    setUser,
    loading,
    isAdmin: () => user?.role === 'admin',
    isViewer: () => user?.role === 'viewer',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
