import api from './client';
import type {
  ApiResponse,
  AlertsResponse,
  AlertRulesResponse,
  AutomationRulesResponse,
  AnalyticsResponse,
  Device,
  DevicesResponse,
  HistoricalDataResponse,
  SensorReadingResponse,
  AlertRule,
  AutomationRule,
} from '../types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getDevices = async (
  page = 1,
  limit = 20,
  status?: string,
): Promise<DevicesResponse> => {
  try {
    const response = await api.get('/devices', {
      params: {
        page,
        limit,
        status,
      },
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

export const getLatestReading = async (
  deviceId: string,
  sensorType = 'temperature',
): Promise<SensorReadingResponse> => {
  try {
    const response = await api.get(`/devices/${deviceId}/data/latest`, {
      params: { sensor_type: sensorType },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getHistoricalData = async (
  deviceId: string,
  sensorType: string,
  start: string,
  end: string,
): Promise<HistoricalDataResponse> => {
  try {
    const response = await api.get(`/devices/${deviceId}/data`, {
      params: {
        sensor_type: sensorType,
        start,
        end,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
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

export const createAutomationRule = async (rule: AutomationRule): Promise<ApiResponse<AutomationRule>> => {
  try {
    const response = await api.post('/automation/rules', rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getAutomationRules = async (): Promise<AutomationRulesResponse> => {
  try {
    const response = await api.get('/automation/rules');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const deleteAutomationRule = async (ruleId: number | string): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/automation/rules/${ruleId}`);
    return { success: true };
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

export const getAnalyticsReport = async ({
  deviceId,
  start,
  end,
  reportType = 'daily',
}: {
  deviceId: number | string;
  start: string;
  end: string;
  reportType?: string;
}): Promise<AnalyticsResponse> => {
  try {
    const response = await api.get('/analytics/report', {
      params: {
        device_id: deviceId,
        start,
        end,
        report_type: reportType,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};