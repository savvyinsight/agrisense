-- Multi-Tenant RBAC Schema
-- This migration adds account (farm business) support and granular permissions

-- Accounts table (represents a subscription customer / farm business)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'professional', 'enterprise')),
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accounts_owner_id ON accounts(owner_id);

-- Add account_id to users table
ALTER TABLE users ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT;
CREATE INDEX idx_users_account_id ON users(account_id);

-- Update users.role CHECK constraint to accept new RBAC roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'viewer', 'account_owner', 'farm_manager', 'operator', 'technician'));

-- Add account_id to devices table
ALTER TABLE devices ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX idx_devices_account_id ON devices(account_id);
UPDATE devices d SET account_id = u.account_id FROM users u WHERE d.user_id = u.id AND d.account_id IS NULL AND u.account_id IS NOT NULL;

-- Add account_id to alert_rules table
ALTER TABLE alert_rules ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX idx_alert_rules_account_id ON alert_rules(account_id);
UPDATE alert_rules ar SET account_id = u.account_id FROM users u WHERE ar.user_id = u.id AND ar.account_id IS NULL AND u.account_id IS NOT NULL;

-- Add account_id to alerts table
ALTER TABLE alerts ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX idx_alerts_account_id ON alerts(account_id);

-- Add account_id to automation_rules table
ALTER TABLE automation_rules ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
UPDATE automation_rules ar SET account_id = u.account_id FROM users u WHERE ar.user_id = u.id AND ar.account_id IS NULL AND u.account_id IS NOT NULL;

-- Add account_id to control_commands table
ALTER TABLE control_commands ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE;
UPDATE control_commands cc SET account_id = u.account_id FROM users u WHERE cc.user_id = u.id AND cc.account_id IS NULL AND u.account_id IS NOT NULL;
CREATE INDEX idx_control_commands_account_id ON control_commands(account_id);

-- User Permissions table (replaces global role with context-specific role)
-- A user can have different roles in different farms within their account
CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    farm_id INTEGER REFERENCES farms(id) ON DELETE CASCADE,  -- NULL = applies to all farms in account
    role VARCHAR(50) NOT NULL CHECK (role IN ('account_owner', 'farm_manager', 'operator', 'technician')),
    granted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, account_id, farm_id, role)
);

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_account_id ON user_permissions(account_id);
CREATE INDEX idx_user_permissions_farm_id ON user_permissions(farm_id);
CREATE INDEX idx_user_permissions_role ON user_permissions(role);

-- User Invitations table (for onboarding new team members)
CREATE TABLE user_invitations (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('account_owner', 'farm_manager', 'operator', 'technician')),
    farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
    invitation_token VARCHAR(255) NOT NULL UNIQUE,
    invited_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMP,
    accepted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_invitations_account_id ON user_invitations(account_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_token ON user_invitations(invitation_token);

-- Audit Log table (for compliance and debugging)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete')),
    resource_type VARCHAR(100) NOT NULL,  -- user, device, alert, farm, irrigation_schedule, etc.
    resource_id VARCHAR(50),
    resource_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure')),
    error_message VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_account_id ON audit_logs(account_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Migration: Create default account for existing users
-- For each existing user with role='admin', create an account where they are owner
INSERT INTO accounts (name, owner_id, subscription_tier)
SELECT 
    COALESCE(u.username || '''s Farm', 'Default Account') as name,
    u.id,
    'professional' as subscription_tier
FROM users u
WHERE u.role = 'admin' AND u.account_id IS NULL;

-- Migration: Assign account_id to all users (system admin creates default account)
-- First, create system admin account if no accounts exist
INSERT INTO accounts (name, owner_id, subscription_tier)
SELECT 'AgriSense System', u.id, 'enterprise'
FROM users u
WHERE u.role = 'admin' AND u.id NOT IN (SELECT owner_id FROM accounts)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Assign users to their accounts
UPDATE users u
SET account_id = (SELECT id FROM accounts WHERE owner_id = u.id LIMIT 1)
WHERE u.role = 'admin' AND account_id IS NULL;

-- For non-admin users, assign them to the first admin's account
UPDATE users u
SET account_id = (
    SELECT a.id FROM accounts a 
    JOIN users admin_user ON admin_user.id = a.owner_id
    WHERE admin_user.role = 'admin' LIMIT 1
)
WHERE u.role != 'admin' AND account_id IS NULL;

-- Migration: Convert old roles to new permissions
INSERT INTO user_permissions (user_id, account_id, role, created_at)
SELECT 
    u.id,
    u.account_id,
    CASE 
        WHEN u.role = 'admin' THEN 'account_owner'
        WHEN u.role = 'viewer' THEN 'operator'
    END,
    NOW()
FROM users u
WHERE u.account_id IS NOT NULL;

-- Tenant isolation constraint: require account_id on all main tables
-- This is enforced at the application middleware level
-- Add comments for documentation
COMMENT ON TABLE accounts IS 'Subscription customers / farm businesses';
COMMENT ON TABLE user_permissions IS 'Granular role assignments - user can have different roles in different farms';
COMMENT ON TABLE user_invitations IS 'Pending user invitations with email-based activation';
COMMENT ON TABLE audit_logs IS 'Compliance audit trail - all mutations logged here';
COMMENT ON COLUMN user_permissions.farm_id IS 'NULL = role applies to all farms; SET = role specific to this farm';
COMMENT ON COLUMN accounts.subscription_tier IS 'basic=single user, professional=small team, enterprise=unlimited';
