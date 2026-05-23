import api from '@/api/client';
import type { ApiResponse, EscalationRule, EscalationRulesResponse, EscalationHistoryResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const getEscalationRules = async (): Promise<EscalationRulesResponse> => {
  try {
    const response = await api.get('/alerts/escalation-rules');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const createEscalationRule = async (rule: Omit<EscalationRule, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<EscalationRule>> => {
  try {
    const response = await api.post('/alerts/escalation-rules', rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const updateEscalationRule = async (id: number, rule: Partial<EscalationRule>): Promise<ApiResponse<EscalationRule>> => {
  try {
    const response = await api.put(`/alerts/escalation-rules/${id}`, rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const deleteEscalationRule = async (id: number): Promise<ApiResponse<null>> => {
  try {
    await api.delete(`/alerts/escalation-rules/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getEscalationHistory = async (alertId: number): Promise<EscalationHistoryResponse> => {
  try {
    const response = await api.get(`/alerts/${alertId}/escalation-history`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
