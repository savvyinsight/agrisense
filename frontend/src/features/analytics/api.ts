import api from '@/api/client';
import type { AnalyticsResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getAnalyticsReport = async (
  params: Record<string, unknown>,
): Promise<AnalyticsResponse> => {
  try {
    const response = await api.get('/analytics/report', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
