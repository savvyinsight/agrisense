import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import type { User, Account, UserPermission } from '@/shared/types/api';

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
  // New multi-tenant methods
  hasRole: (role: string, farmId?: number) => boolean;
  hasPermission: (role: string, farmId?: number) => boolean;
  switchAccount: (accountId: number) => Promise<void>;
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
  const [account, setAccount] = useState<Account | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const accountData = localStorage.getItem('account');
    const permissionsData = localStorage.getItem('permissions');

    if (token && userData) {
      const parsedUser = JSON.parse(userData) as User;
      setUser(parsedUser);

      if (accountData) {
        setAccount(JSON.parse(accountData));
      }

      if (permissionsData) {
        setPermissions(JSON.parse(permissionsData));
      }
    }
    setLoading(false);
  }, []);

  // Legacy role checks (for backward compatibility)
  const isAdmin = () => user?.role === 'admin' || user?.role === 'account_owner';
  const isViewer = () => user?.role === 'viewer' || user?.role === 'operator';

  // New role check (multi-tenant aware)
  const hasRole = (role: string, farmId?: number): boolean => {
    if (!user) return false;

    // Admin and account_owner can do anything
    if (user.role === 'admin' || user.role === 'account_owner') return true;

    // Check permissions list
    return permissions.some(perm => {
      // Role must match
      if (perm.role !== role) return false;

      // If farmId is specified, permission must apply to that farm or all farms
      if (farmId !== undefined) {
        return perm.farm_id === null || perm.farm_id === farmId;
      }

      // No farmId specified, permission must be account-level
      return perm.farm_id === null;
    });
  };

  // Alias for hasRole
  const hasPermission = (role: string, farmId?: number): boolean => hasRole(role, farmId);

  const switchAccount = async (accountId: number): Promise<void> => {
    // This would call backend to load account data and permissions
    // For now, just update local state
    console.log('Switching to account:', accountId);
    // TODO: Implement account switching logic
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
