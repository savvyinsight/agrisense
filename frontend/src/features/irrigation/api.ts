import api from '@/api/client';
import type { ApiResponse } from '@/shared/types';

export interface IrrigationEvent {
  id: number;
  zone_id: number;
  field_id: number;
  device_id?: number | null;
  status: 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string | null;
  duration_minutes: number;
  water_usage_liters: number;
  trigger_type: 'manual' | 'schedule' | 'rule';
  triggered_by?: number | null;
  created_at: string;
}

export interface IrrigationZone {
  id: number;
  name: string;
  field_id: number;
  device_id?: number | null;
  device_name?: string;
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

export const createZone = async (zone: {
  name: string;
  field_id: number;
  device_id?: number | null;
  target_moisture: number;
  flow_rate_lpm: number;
}): Promise<ApiResponse<IrrigationZone>> => {
  try {
    const response = await api.post('/irrigation/zones', zone);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to create zone' };
  }
};

export const updateZone = async (id: number, zone: {
  name?: string;
  target_moisture?: number;
  flow_rate_lpm?: number;
}): Promise<ApiResponse<IrrigationZone>> => {
  try {
    const response = await api.put(`/irrigation/zones/${id}`, zone);
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to update zone' };
  }
};

export const deleteZone = async (id: number): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/irrigation/zones/${id}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to delete zone' };
  }
};

export const getIrrigationEvents = async (params: { zone_id?: number; field_id?: number }): Promise<ApiResponse<IrrigationEvent[]>> => {
  try {
    const response = await api.get('/irrigation/zones/events', { params });
    return { success: true, data: response.data.data || response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to load events' };
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
