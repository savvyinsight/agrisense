import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/react';
import * as teamApi from '../api/teamApi';
import {
  type TeamMember,
  type InvitationRequest,
  type AuditLogEntry,
  type AuditLogFilters,
  type PermissionUpdateRequest,
} from '../api/types/team';

export interface TeamState {
  // State
  teamMembers: TeamMember[];
  auditLog: AuditLogEntry[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchTeamMembers: (accountId: number) => Promise<void>;
  inviteUser: (accountId: number, request: InvitationRequest) => Promise<void>;
  updatePermission: (accountId: number, request: PermissionUpdateRequest) => Promise<void>;
  revokeAccess: (accountId: number, userId: number) => Promise<void>;
  fetchAuditLog: (accountId: number, filters?: AuditLogFilters) => Promise<void>;
  clearError: () => void;
}

export const useTeamStore = create<TeamState>()(
  subscribeWithSelector((set) => ({
    teamMembers: [],
    auditLog: [],
    loading: false,
    error: null,

    fetchTeamMembers: async (accountId: number) => {
      set({ loading: true, error: null });
      try {
        const members = await teamApi.listTeamMembers(accountId);
        set({ teamMembers: members, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch team members';
        set({ error: message, loading: false });
      }
    },

    inviteUser: async (accountId: number, request: InvitationRequest) => {
      set({ loading: true, error: null });
      try {
        await teamApi.inviteUser(accountId, request);
        // Refresh team members list after successful invite
        const members = await teamApi.listTeamMembers(accountId);
        set({ teamMembers: members, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to invite user';
        set({ error: message, loading: false });
        throw err; // Re-throw so caller can handle
      }
    },

    updatePermission: async (accountId: number, request: PermissionUpdateRequest) => {
      set({ loading: true, error: null });
      try {
        await teamApi.updatePermission(accountId, request);
        // Refresh team members list after successful update
        const members = await teamApi.listTeamMembers(accountId);
        set({ teamMembers: members, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update permission';
        set({ error: message, loading: false });
        throw err;
      }
    },

    revokeAccess: async (accountId: number, userId: number) => {
      set({ loading: true, error: null });
      try {
        await teamApi.revokeAccess(accountId, userId);
        // Refresh team members list after revocation
        const members = await teamApi.listTeamMembers(accountId);
        set({ teamMembers: members, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke access';
        set({ error: message, loading: false });
        throw err;
      }
    },

    fetchAuditLog: async (accountId: number, filters?: AuditLogFilters) => {
      set({ loading: true, error: null });
      try {
        const log = await teamApi.getAuditLog(accountId, filters);
        set({ auditLog: log, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch audit log';
        set({ error: message, loading: false });
      }
    },

    clearError: () => set({ error: null }),
  }))
);
