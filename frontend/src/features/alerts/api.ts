import api from '@/api/client';
import type {
  ApiResponse,
  AlertsResponse,
  AlertRule,
  AlertRulesResponse,
} from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getActiveAlerts = async (page = 1, limit = 20): Promise<AlertsResponse> => {
  try {
    const response = await api.get('/alerts/active', {
      params: { page, limit },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const acknowledgeAlert = async (alertId: number | string): Promise<ApiResponse<null>> => {
  try {
    const response = await api.post(`/alerts/${alertId}/acknowledge`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const resolveAlert = async (alertId: number | string): Promise<ApiResponse<null>> => {
  try {
    const response = await api.post(`/alerts/${alertId}/resolve`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getAlertHistory = async (page = 1, limit = 20): Promise<AlertsResponse> => {
  try {
    const response = await api.get('/alerts/history', {
      params: { page, limit },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const createAlertRule = async (rule: AlertRule): Promise<ApiResponse<AlertRule>> => {
  try {
    const response = await api.post('/alerts/rules', rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getAlertRules = async (): Promise<AlertRulesResponse> => {
  try {
    const response = await api.get('/alerts/rules');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const deleteAlertRule = async (ruleId: number | string): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/alerts/rules/${ruleId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
