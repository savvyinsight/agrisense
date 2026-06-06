import { create } from 'zustand';
import type { Device } from '@/shared/types';

interface DevicesState {
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  updateDeviceStatus: (deviceId: string, status: 'online' | 'offline', name?: string) => void;
  onlineCount: () => number;
}

export const useDevicesStore = create<DevicesState>()((set, get) => ({
  devices: [],
  setDevices: (devices) => set({ devices }),
  updateDeviceStatus: (deviceId, status, name) =>
    set((state) => {
      const idx = state.devices.findIndex((d) => d.device_id === deviceId);
      if (idx === -1) {
        // Device not in store (e.g., WS event arrived before initial fetch or device was added after page load).
        // Append a minimal device object so it appears in the UI.
        const now = new Date().toISOString();
        const minimal: Device = {
          id: 0,
          device_id: deviceId,
          name: name || deviceId,
          type: 'sensor',
          status,
          location: '',
          last_heartbeat: status === 'online' ? now : undefined,
        };
        return { devices: [...state.devices, minimal] };
      }
      const updated = [...state.devices];
      updated[idx] = {
        ...updated[idx],
        status,
        last_heartbeat: status === 'online' ? new Date().toISOString() : updated[idx].last_heartbeat,
      };
      return { devices: updated };
    }),
  onlineCount: () => get().devices.filter((d) => d.status === 'online').length,
}));
