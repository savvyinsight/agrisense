import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import type { User, Account, UserPermission } from '@/shared/types/api';
import { useAuthStore } from '@/shared/stores/authStore';

type AuthContextType = {
  user: User | null;
  account: Account | null;
  permissions: UserPermission[];
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setAccount: React.Dispatch<React.SetStateAction<Account | null>>;
  setPermissions: React.Dispatch<React.SetStateAction<UserPermission[]>>;
  loading: boolean;
  isAdmin: () => boolean;
  isViewer: () => boolean;
  hasRole: (role: string, farmId?: number) => boolean;
  hasPermission: (role: string, farmId?: number) => boolean;
  switchAccount: (accountId: number) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading, setAuth, clearAuth, setLoading } = useAuthStore();
  const [account, setAccount] = React.useState<Account | null>(null);
  const [permissions, setPermissions] = React.useState<UserPermission[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const accountData = localStorage.getItem('account');
    const permissionsData = localStorage.getItem('permissions');

    if (token && userData) {
      const parsed = JSON.parse(userData) as User;
      setAuth(parsed, token);

      if (accountData) {
        setAccount(JSON.parse(accountData));
      }

      if (permissionsData) {
        setPermissions(JSON.parse(permissionsData));
      }
    } else {
      setLoading(false);
    }
  }, [setAuth, setLoading]);

  const isAdmin = () => user?.role === 'admin' || user?.role === 'account_owner';
  const isViewer = () => user?.role === 'viewer' || user?.role === 'operator';

  const hasRole = (role: string, farmId?: number): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'account_owner') return true;
    return permissions.some(perm => {
      if (perm.role !== role) return false;
      if (farmId !== undefined) {
        return perm.farm_id === null || perm.farm_id === farmId;
      }
      return perm.farm_id === null;
    });
  };

  const hasPermission = (role: string, farmId?: number): boolean => hasRole(role, farmId);

  const switchAccount = async (accountId: number): Promise<void> => {
    console.log('Switching to account:', accountId);
  };

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
    account,
    permissions,
    setUser,
    setAccount,
    setPermissions,
    loading,
    isAdmin,
    isViewer,
    hasRole,
    hasPermission,
    switchAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};