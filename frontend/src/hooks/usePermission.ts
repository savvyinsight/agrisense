import { useAuth } from '@/features/auth/AuthContext';

/**
 * usePermission - Hook for checking granular permissions
 * 
 * Usage:
 *   const { can } = usePermission();
 *   if (can('farm_manager')) { ... }
 *   if (can('operator', farmId)) { ... }
 */
export const usePermission = () => {
  const { user, hasPermission } = useAuth();

  const can = (role: string, farmId?: number): boolean => {
    if (!user) return false;
    return hasPermission(role, farmId);
  };

  const canInviteUsers = (farmId?: number): boolean => {
    return can('account_owner', farmId) || can('farm_manager', farmId);
  };

  const canManageFarm = (farmId?: number): boolean => {
    return can('account_owner', farmId) || can('farm_manager', farmId);
  };

  const canOperateIrrigation = (farmId?: number): boolean => {
    return can('account_owner', farmId) || can('farm_manager', farmId) || can('operator', farmId);
  };

  const canViewAnalytics = (farmId?: number): boolean => {
    return can('account_owner', farmId) || can('farm_manager', farmId) || can('operator', farmId);
  };

  const canManageDevices = (farmId?: number): boolean => {
    return can('account_owner', farmId) || can('farm_manager', farmId) || can('technician', farmId);
  };

  const canViewAuditLog = (farmId?: number): boolean => {
    return can('account_owner', farmId);
  };

  return {
    can,
    canInviteUsers,
    canManageFarm,
    canOperateIrrigation,
    canViewAnalytics,
    canManageDevices,
    canViewAuditLog,
  };
};

export default usePermission;
