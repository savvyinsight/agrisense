import api from '@/api/client';
import type {
  HistoricalDataResponse,
  SensorReadingResponse,
} from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
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
