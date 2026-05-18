import api from '@/api/client';
import type { ApiResponse, AggregatedDataPoint } from '@/shared/types';
import type { Field } from '@/shared/types';

export const getFields = async (): Promise<ApiResponse<Field[]>> => {
  try {
    const response = await api.get('/fields');
    return { success: true, data: response.data.data || response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to load fields' };
  }
};

export const getField = async (id: number): Promise<ApiResponse<Field>> => {
  try {
    const response = await api.get(`/fields/${id}`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Field not found' };
  }
};

export const createField = async (field: Partial<Field>): Promise<ApiResponse<Field>> => {
  try {
    const response = await api.post('/fields', field);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to create field' };
  }
};

export const updateField = async (id: number, updates: Partial<Field>): Promise<ApiResponse<Field>> => {
  try {
    const response = await api.put(`/fields/${id}`, updates);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to update field' };
  }
};

export const deleteField = async (id: number): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/fields/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to delete field' };
  }
};

export const getDeviceAggregatedData = async (
  deviceId: number,
  sensorType: string,
  interval: string = '24h',
): Promise<ApiResponse<AggregatedDataPoint[]>> => {
  try {
    const response = await api.get(`/devices/${deviceId}/data/aggregated`, {
      params: { sensor_type: sensorType, interval },
    });
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to load trend data' };
  }
};
