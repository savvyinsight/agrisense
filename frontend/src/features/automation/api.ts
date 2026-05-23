import api from '@/api/client';
import type { ApiResponse, AutomationRule, AutomationRulesResponse, AutomationDashboardResponse, AutomationExecution, Command } from '@/shared/types/api';

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

export const updateAutomationRule = async (
  ruleId: number,
  rule: Partial<AutomationRule>,
): Promise<ApiResponse<AutomationRule>> => {
  try {
    const response = await api.put(`/automation/rules/${ruleId}`, rule);
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

export const pauseAutomationRule = async (ruleId: number): Promise<ApiResponse<AutomationRule>> => {
  return updateAutomationRule(ruleId, { paused: true });
};

export const resumeAutomationRule = async (ruleId: number): Promise<ApiResponse<AutomationRule>> => {
  return updateAutomationRule(ruleId, { paused: false });
};

export const runAutomationRuleNow = async (ruleId: number): Promise<ApiResponse<null>> => {
  try {
    await api.post(`/automation/rules/${ruleId}/execute`);
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getCommandHistory = async (ruleId: number, limit = 20): Promise<ApiResponse<{ commands: Command[]; total?: number }>> => {
  try {
    const response = await api.get(`/automation/rules/${ruleId}/commands`, { params: { limit } });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const retryCommand = async (commandId: number): Promise<ApiResponse<Command>> => {
  try {
    const response = await api.post(`/control/commands/${commandId}/retry`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getAutomationDashboard = async (): Promise<AutomationDashboardResponse> => {
  try {
    const response = await api.get('/automation/dashboard');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const setGlobalAutomation = async (enabled: boolean): Promise<ApiResponse<null>> => {
  try {
    await api.post('/automation/global-toggle', { enabled });
    return { success: true };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};

export const getAutomationExecutions = async (params?: { rule_id?: number; limit?: number }): Promise<ApiResponse<AutomationExecution[]>> => {
  try {
    const response = await api.get('/automation/executions', { params });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: handleError(error) };
  }
};
