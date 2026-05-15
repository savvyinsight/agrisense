// Team management types

export type UserRole = 'account_owner' | 'farm_manager' | 'operator' | 'technician';

export interface TeamMember {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  farm_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationRequest {
  email: string;
  role: UserRole;
  farm_id?: number | null;
}

export interface InvitationResponse {
  id: number;
  email: string;
  role: UserRole;
  farm_id: number | null;
  invitation_token: string;
  expires_at: string;
  created_at: string;
}

export interface PermissionUpdateRequest {
  user_id: number;
  role: UserRole;
  farm_id?: number | null;
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_name: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  user_id?: number;
  action?: string;
  resource_type?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}
