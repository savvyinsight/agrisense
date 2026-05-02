import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import type { User } from '../types/api';

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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData) as User);
    }
    setLoading(false);
  }, []);

  const isAdmin = () => user?.role === 'admin';
  const isViewer = () => user?.role === 'viewer';

  const value: AuthContextType = {
    user,
    setUser,
    loading,
    isAdmin,
    isViewer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

};
