import api from '@/api/client';
import type { ApiResponse } from '@/shared/types';

export interface WeatherCurrent {
  temperature?: number;
  humidity?: number;
  rainfall_mm: number;
  wind_speed: number;
  forecast: string;
}

export const getCurrentWeather = async (): Promise<ApiResponse<WeatherCurrent>> => {
  try {
    const response = await api.get('/weather/current');
    return { success: true, data: response.data };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error || 'Failed to load weather' };
  }
};
