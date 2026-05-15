import { create } from 'zustand';
import type { User } from '@/shared/types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  isAdmin: () => boolean;
  isViewer: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  loading: true,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, loading: false });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('account');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, loading: false });
  },
  setLoading: (loading) => set({ loading }),
  isAdmin: () => { const r = get().user?.role; return r === 'admin' || r === 'account_owner'; },
  isViewer: () => { const r = get().user?.role; return r === 'viewer' || r === 'operator' || r === 'technician'; },
}));
