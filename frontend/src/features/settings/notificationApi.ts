import api from '@/api/client';
import type { ApiResponse, NotificationChannel, NotificationRoutingRule, NotificationSettingsResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getNotificationSettings = async (): Promise<NotificationSettingsResponse> => {
  try {
    const response = await api.get('/notifications/settings');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const createChannel = async (channel: Omit<NotificationChannel, 'id'>): Promise<ApiResponse<NotificationChannel>> => {
  try {
    const response = await api.post('/notifications/channels', channel);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const updateChannel = async (id: number, channel: Partial<NotificationChannel>): Promise<ApiResponse<NotificationChannel>> => {
  try {
    const response = await api.put(`/notifications/channels/${id}`, channel);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const deleteChannel = async (id: number): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/notifications/channels/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const updateRoutingRule = async (id: number, rule: Partial<NotificationRoutingRule>): Promise<ApiResponse<NotificationRoutingRule>> => {
  try {
    const response = await api.put(`/notifications/routing/${id}`, rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const testNotification = async (channelId: number): Promise<ApiResponse<null>> => {
  try {
    await api.post(`/notifications/channels/${channelId}/test`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
