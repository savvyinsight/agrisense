import api from './client';
import {
  type TeamMember,
  type InvitationRequest,
  type InvitationResponse,
  type PermissionUpdateRequest,
  type AuditLogEntry,
  type AuditLogFilters,
} from './types/team';

/**
 * List all team members in an account
 */
export async function listTeamMembers(accountId: number): Promise<TeamMember[]> {
  try {
    const { data } = await api.get(`/accounts/${accountId}/users`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to list team members:', error);
    throw error;
  }
}

/**
 * Invite a new user to the account
 */
export async function inviteUser(
  accountId: number,
  request: InvitationRequest
): Promise<InvitationResponse> {
  try {
    const { data } = await api.post(`/accounts/${accountId}/users/invite`, request);
    return data;
  } catch (error) {
    console.error('Failed to invite user:', error);
    throw error;
  }
}

/**
 * Update a user's role and/or farm assignment
 */
export async function updatePermission(
  accountId: number,
  request: PermissionUpdateRequest
): Promise<void> {
  try {
    await api.put(`/accounts/${accountId}/users/permission`, request);
  } catch (error) {
    console.error('Failed to update user permission:', error);
    throw error;
  }
}

/**
 * Revoke a user's access to the account
 */
export async function revokeAccess(
  accountId: number,
  userId: number
): Promise<void> {
  try {
    await api.delete(`/accounts/${accountId}/users/${userId}`);
  } catch (error) {
    console.error('Failed to revoke user access:', error);
    throw error;
  }
}

/**
 * Get audit log entries for the account
 */
export async function getAuditLog(
  accountId: number,
  filters?: AuditLogFilters
): Promise<AuditLogEntry[]> {
  try {
    const { data } = await api.get(`/accounts/${accountId}/audit`, { params: filters });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Failed to fetch audit log:', error);
    throw error;
  }
}
