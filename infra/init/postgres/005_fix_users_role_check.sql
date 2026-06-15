-- Fix users.role CHECK constraint to allow all RBAC roles
-- The original constraint only allowed 'admin' and 'viewer'
-- After multi-tenant RBAC, we also need 'account_owner', 'farm_manager', 'operator', 'technician'

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'viewer', 'account_owner', 'farm_manager', 'operator', 'technician'));
