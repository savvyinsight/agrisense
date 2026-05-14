-- Tenant Isolation Test Suite
-- Run these queries to verify multi-tenant RBAC is working correctly

-- TEST 1: Verify Account Creation and Ownership
-- Expected: Show accounts with their owners
SELECT a.id, a.name, a.subscription_tier, u.email as owner_email, a.created_at
FROM accounts a
JOIN users u ON a.owner_id = u.id
ORDER BY a.created_at DESC;

-- TEST 2: Verify User-Account Assignment
-- Expected: All users should have an account_id
SELECT id, email, account_id
FROM users
WHERE account_id IS NULL
-- Should return 0 rows (no unassigned users)

-- TEST 3: Verify Permission Assignment
-- Expected: Show all user permissions with context
SELECT 
    up.id,
    u.email,
    a.name as account_name,
    COALESCE(f.name, 'All Farms') as farm_scope,
    up.role,
    up.created_at
FROM user_permissions up
JOIN users u ON up.user_id = u.id
JOIN accounts a ON up.account_id = a.id
LEFT JOIN farms f ON up.farm_id = f.id
ORDER BY a.id, u.id;

-- TEST 4: Verify Account_id is Set on Related Tables
-- Expected: No rows (all devices, rules, alerts should have account_id)
SELECT 'devices without account_id' as issue, COUNT(*) as count FROM devices WHERE account_id IS NULL
UNION ALL
SELECT 'alert_rules without account_id', COUNT(*) FROM alert_rules WHERE account_id IS NULL
UNION ALL
SELECT 'alerts without account_id', COUNT(*) FROM alerts WHERE account_id IS NULL
UNION ALL
SELECT 'automation_rules without account_id', COUNT(*) FROM automation_rules WHERE account_id IS NULL;

-- TEST 5: Verify Invitation System
-- Expected: Show pending invitations
SELECT 
    id,
    email,
    role,
    (SELECT name FROM accounts WHERE id = user_invitations.account_id) as account_name,
    created_at,
    expires_at,
    CASE 
        WHEN expires_at > NOW() THEN 'Valid'
        ELSE 'Expired'
    END as status
FROM user_invitations
WHERE accepted_at IS NULL
ORDER BY created_at DESC;

-- TEST 6: Verify Audit Log Entries
-- Expected: Show recent audit activity
SELECT 
    id,
    user_id,
    action,
    resource_type,
    resource_id,
    status,
    created_at
FROM audit_logs
WHERE account_id > 0
ORDER BY created_at DESC
LIMIT 20;

-- TEST 7: Tenant Isolation Test - Count Resources per Account
-- Expected: Each account should be isolated
SELECT 
    a.name as account,
    COUNT(DISTINCT u.id) as user_count,
    COUNT(DISTINCT d.id) as device_count,
    COUNT(DISTINCT ar.id) as alert_rule_count,
    COUNT(DISTINCT al.id) as alert_count
FROM accounts a
LEFT JOIN users u ON a.id = u.account_id
LEFT JOIN devices d ON a.id = d.account_id
LEFT JOIN alert_rules ar ON a.id = ar.account_id
LEFT JOIN alerts al ON a.id = al.account_id
GROUP BY a.id, a.name
ORDER BY a.created_at;

-- TEST 8: Verify Role Distribution
-- Expected: Show roles by account
SELECT 
    (SELECT name FROM accounts WHERE id = up.account_id) as account_name,
    role,
    COUNT(*) as user_count
FROM user_permissions up
GROUP BY up.account_id, role
ORDER BY account_name, role;

-- TEST 9: Identify Cross-Account Anomalies
-- Expected: Should return 0 rows (no user should have permissions in multiple account unless intended)
SELECT 
    u.id,
    u.email,
    COUNT(DISTINCT up.account_id) as account_count
FROM users u
JOIN user_permissions up ON u.id = up.user_id
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT up.account_id) > 1
ORDER BY account_count DESC;

-- TEST 10: Verify Farm-Level Permission Scoping
-- Expected: Show farm-scoped permissions
SELECT 
    u.email,
    a.name as account_name,
    f.name as farm_name,
    up.role
FROM user_permissions up
JOIN users u ON up.user_id = u.id
JOIN accounts a ON up.account_id = a.id
LEFT JOIN farms f ON up.farm_id = f.id
WHERE up.farm_id IS NOT NULL
ORDER BY a.id, f.id;

-- TEST 11: Verify Audit Log Completeness
-- Expected: Check that all major mutations are logged
SELECT 
    resource_type,
    action,
    COUNT(*) as count,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM audit_logs
GROUP BY resource_type, action
ORDER BY resource_type, action;

-- TEST 12: Check for Orphaned Permissions
-- Expected: Should return 0 rows
SELECT up.id, up.user_id, up.account_id
FROM user_permissions up
LEFT JOIN users u ON up.user_id = u.id
LEFT JOIN accounts a ON up.account_id = a.id
WHERE u.id IS NULL OR a.id IS NULL;

-- TEST 13: Verify Device Ownership
-- Expected: All devices should belong to exactly one account
SELECT 
    d.name,
    d.account_id,
    a.name as account_name,
    COUNT(DISTINCT d.id) as device_count
FROM devices d
LEFT JOIN accounts a ON d.account_id = a.id
GROUP BY d.account_id, a.id, a.name, d.name;

-- TEST 14: Check for Broken References
-- Expected: Should return 0 rows
SELECT 'Broken device refs' as issue, COUNT(*) as count
FROM devices WHERE account_id NOT IN (SELECT id FROM accounts)
UNION ALL
SELECT 'Broken alert refs', COUNT(*)
FROM alerts WHERE account_id NOT IN (SELECT id FROM accounts)
UNION ALL
SELECT 'Broken user refs', COUNT(*)
FROM users WHERE account_id NOT IN (SELECT id FROM accounts)
UNION ALL
SELECT 'Broken permission refs', COUNT(*)
FROM user_permissions 
WHERE account_id NOT IN (SELECT id FROM accounts)
OR user_id NOT IN (SELECT id FROM users);

-- TEST 15: Performance - Index Usage Check
-- Expected: Verify indexes are present and efficiently used
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('accounts', 'users', 'user_permissions', 'user_invitations', 'audit_logs')
ORDER BY tablename, indexname;

-- ===========================
-- DATA CLEANUP / RESET (USE WITH CAUTION)
-- ===========================

-- To fully reset multi-tenant data (development only):
-- DELETE FROM audit_logs;
-- DELETE FROM user_invitations;
-- DELETE FROM user_permissions;
-- DELETE FROM devices;
-- DELETE FROM alerts;
-- DELETE FROM alert_rules;
-- DELETE FROM automation_rules;
-- DELETE FROM control_commands;
-- UPDATE users SET account_id = NULL;
-- DELETE FROM accounts;
