import api from '@/api/client';
import type { ApiResponse } from '@/shared/types';

/**
 * Batch device data API - optimized for bulk operations
 * Reduces N+1 queries by fetching multiple devices' latest readings in one request
 */

export interface DeviceWithLatestReading {
  device_id: string;
  id: number;
  name: string;
  type: string;
  status: 'online' | 'offline';
  location: string;
  latitude?: number;
  longitude?: number;
  field_id?: number | null;
  latestTemp?: number | null;
  last_heartbeat?: string;
  created_at?: string;
  updated_at?: string;
  readings?: {
    temperature?: number;
    moisture?: number;
    humidity?: number;
    [key: string]: number | undefined;
  };
}

export interface BatchDeviceDataResponse {
  success: boolean;
  data?: {
    devices: DeviceWithLatestReading[];
    total?: number;
    cached?: boolean;
    cached_at?: string;
  };
  error?: string;
}

/**
 * Fetch multiple devices with their latest readings in a single request
 * This replaces N separate calls to getDevicesDataLatest
 */
export const getDevicesBatchWithLatestReadings = async (
  deviceIds: string[]
): Promise<BatchDeviceDataResponse> => {
  if (deviceIds.length === 0) {
    return { success: true, data: { devices: [] } };
  }

  try {
    // Call batch endpoint if available, fallback to individual requests
    const response = await api.post('/devices/batch/latest', {
      device_ids: deviceIds,
    }).catch(() => null);

    if (response) {
      return { success: true, data: response.data };
    }

    // Fallback: Make individual requests (less efficient)
    const devices = await Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          const res = await api.get(`/devices/${deviceId}/latest`);
          return res.data;
        } catch {
          return null;
        }
      })
    );

    return {
      success: true,
      data: {
        devices: devices.filter((d) => d !== null),
        cached: false,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error || 'Failed to fetch batch device data',
    };
  }
};

/**
 * Fetch devices by field with their latest readings
 * Optimized for dashboard layout
 */
export const getDevicesByFieldWithReadings = async (
  fieldId: number
): Promise<BatchDeviceDataResponse> => {
  try {
    const response = await api.get(`/fields/${fieldId}/devices/batch`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return {
      success: false,
      error: error?.response?.data?.error || 'Failed to fetch field devices',
    };
  }
};

/**
 * Cache device readings locally to reduce API calls
 * Configurable TTL (time-to-live)
 */
class DeviceDataCache {
  private cache = new Map<
    string,
    { data: DeviceWithLatestReading; timestamp: number }
  >();
  private ttl = 30000; // 30 seconds default

  set(deviceId: string, data: DeviceWithLatestReading, ttl?: number): void {
    this.cache.set(deviceId, { data, timestamp: Date.now() });
    if (ttl) {
      setTimeout(() => this.cache.delete(deviceId), ttl);
    } else {
      setTimeout(() => this.cache.delete(deviceId), this.ttl);
    }
  }

  get(deviceId: string): DeviceWithLatestReading | null {
    const cached = this.cache.get(deviceId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(deviceId);
      return null;
    }

    return cached.data;
  }

  getMultiple(deviceIds: string[]): Map<string, DeviceWithLatestReading> {
    const result = new Map<string, DeviceWithLatestReading>();
    for (const id of deviceIds) {
      const cached = this.get(id);
      if (cached) {
        result.set(id, cached);
      }
    }
    return result;
  }

  clear(): void {
    this.cache.clear();
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }
}

export const deviceDataCache = new DeviceDataCache();

/**
 * Smart fetch with caching
 * Returns cached data if available, otherwise fetches and caches
 */
export const getDevicesBatchSmartWithCache = async (
  deviceIds: string[],
  options?: { skipCache?: boolean; ttl?: number }
): Promise<BatchDeviceDataResponse> => {
  const skipCache = options?.skipCache || false;

  if (!skipCache) {
    // Get cached items
    const cached = deviceDataCache.getMultiple(deviceIds);
    const cachedIds = Array.from(cached.keys());
    const uncachedIds = deviceIds.filter((id) => !cachedIds.includes(id));

    if (cachedIds.length > 0 && uncachedIds.length === 0) {
      // All cached
      return {
        success: true,
        data: {
          devices: Array.from(cached.values()),
          cached: true,
          cached_at: new Date().toISOString(),
        },
      };
    }

    // Fetch uncached, merge with cached
    if (uncachedIds.length > 0) {
      const fetchRes = await getDevicesBatchWithLatestReadings(uncachedIds);
      if (fetchRes.success && fetchRes.data) {
        // Cache the newly fetched data
        fetchRes.data.devices.forEach((device) => {
          deviceDataCache.set(device.device_id, device, options?.ttl);
        });

        // Merge with cached
        return {
          success: true,
          data: {
            devices: [...Array.from(cached.values()), ...fetchRes.data.devices],
            cached: false,
          },
        };
      }
      return fetchRes;
    }
  }

  // No cache, fetch all
  return getDevicesBatchWithLatestReadings(deviceIds);
};
