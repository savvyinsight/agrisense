import api from '@/api/client';
import type { ApiResponse, Device, DevicesResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getDevices = async (
  page = 1,
  limit = 20,
  status?: string,
  q?: string,
): Promise<DevicesResponse> => {
  try {
    const response = await api.get('/devices', {
      params: { page, limit, status, q: q || undefined },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getDevice = async (id: number | string): Promise<ApiResponse<Device>> => {
  try {
    const response = await api.get(`/devices/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const createDevice = async (device: Partial<Device>): Promise<ApiResponse<Device>> => {
  try {
    const response = await api.post('/devices', device);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const updateDevice = async (
  id: number | string,
  payload: Partial<Device>,
): Promise<ApiResponse<Device>> => {
  try {
    const response = await api.put(`/devices/${id}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const deleteDevice = async (id: number | string): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/devices/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getDevicesByStatus = async (
  page = 1,
  limit = 20,
  status = 'online',
): Promise<DevicesResponse> => {
  try {
    const response = await api.get('/devices', {
      params: { page, limit, status },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getDevicesDataLatest = async (deviceIds: string[] = []): Promise<ApiResponse<any>> => {
  try {
    if (!deviceIds.length) {
      return { success: true, data: { devices: [] } };
    }
    const response = await api.get('/devices/data/latest', {
      params: {
        device_ids: deviceIds.join(','),
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const sendCommand = async (
  deviceId: string,
  commandPayload: Record<string, unknown>,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post(`/devices/${deviceId}/commands`, commandPayload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const claimDevice = async (deviceId: string): Promise<ApiResponse<Device>> => {
  try {
    const response = await api.post('/devices/claim', { device_id: deviceId });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const unclaimDevice = async (deviceId: string): Promise<ApiResponse<null>> => {
  try {
    await api.post(`/devices/${deviceId}/unclaim`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getCommandStatus = async (
  deviceId: string,
  commandId: string | number,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get(`/devices/${deviceId}/commands/${commandId}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
