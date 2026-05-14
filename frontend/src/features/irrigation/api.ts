import api from '@/api/client';
import type { ApiResponse } from '@/shared/types';

export interface IrrigationZone {
  id: number;
  name: string;
  field_id: number;
  moisture: number;
  target_moisture: number;
  status: 'active' | 'scheduled' | 'idle' | 'failed';
  runtime_minutes: number;
  flow_rate_lpm: number;
}

export const getZones = async (fieldId?: number): Promise<ApiResponse<IrrigationZone[]>> => {
  try {
    const params = fieldId ? { field_id: fieldId } : {};
    const response = await api.get('/irrigation/zones', { params });
    return { success: true, data: response.data.data || response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to load zones' };
  }
};

export const startZone = async (id: number): Promise<ApiResponse<IrrigationZone>> => {
  try {
    const response = await api.post(`/irrigation/zones/${id}/start`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to start zone' };
  }
};

export const stopZone = async (id: number): Promise<ApiResponse<IrrigationZone>> => {
  try {
    const response = await api.post(`/irrigation/zones/${id}/stop`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to stop zone' };
  }
};

export const retryZone = async (id: number): Promise<ApiResponse<IrrigationZone>> => {
  try {
    const response = await api.post(`/irrigation/zones/${id}/retry`);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to retry zone' };
  }
};
