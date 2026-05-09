import api from '@/api/client';
import type { ApiResponse, AutomationRule, AutomationRulesResponse } from '@/shared/types/api';

const handleError = (error: unknown): string => {
  return (error as any)?.response?.data?.error || (error as Error).message || 'Request failed';
};

export const createAutomationRule = async (
  rule: AutomationRule,
): Promise<ApiResponse<AutomationRule>> => {
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
