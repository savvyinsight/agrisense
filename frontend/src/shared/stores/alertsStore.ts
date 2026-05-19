import { create } from 'zustand';
import type { Alert2 } from '@/shared/types';

interface AlertsState {
  alerts: Alert2[];
  activeCount: number;
  setAlerts: (alerts: Alert2[]) => void;
  addAlert: (alert: Alert2) => void;
  updateAlert: (id: number, updates: Partial<Alert2>) => void;
  removeAlert: (id: number) => void;
}

export const useAlertsStore = create<AlertsState>()((set) => ({
  alerts: [],
  activeCount: 0,
  setAlerts: (alerts) =>
    set({
      alerts,
      activeCount: alerts.filter((a) => a.status === 'active').length,
    }),
  addAlert: (alert) =>
    set((state) => {
      if (state.alerts.some((a) => a.id === alert.id)) return state;
      return {
        alerts: [alert, ...state.alerts],
        activeCount: state.activeCount + (alert.status === 'active' ? 1 : 0),
      };
    }),
  updateAlert: (id, updates) =>
    set((state) => {
      const next = state.alerts.map((a) => (a.id === id ? { ...a, ...updates } : a));
      return {
        alerts: next,
        activeCount: next.filter((a) => a.status === 'active').length,
      };
    }),
  removeAlert: (id) =>
    set((state) => {
      const next = state.alerts.filter((a) => a.id !== id);
      return {
        alerts: next,
        activeCount: next.filter((a) => a.status === 'active').length,
      };
    }),
}));
