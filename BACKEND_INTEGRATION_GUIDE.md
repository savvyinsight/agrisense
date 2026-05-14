# Backend Integration Guide - Multi-Tenant RBAC

**Status**: Backend routes mounted, JWT updated, ready for testing
**Date**: May 2026
**Phase**: Backend Integration + Live Testing

---

## 1. ENVIRONMENT SETUP

### 1.1 Required Infrastructure
- PostgreSQL 12+ (running)
- Redis (running)
- InfluxDB (running)
- MQTT broker (running)
- Backend compiled and running on port 8080

### 1.2 Database Migration

Before testing, run the multi-tenant schema migration:

```bash
# From backend directory
psql -U agrisense_user -d agrisense -f deployments/init/postgres/002_multi_tenant_rbac.sql
```

**Verify 4 new tables created**:
```bash
psql -U agrisense_user -d agrisense -c "\dt accounts user_permissions user_invitations audit_logs"
```

Expected output:
```
           List of relations
 Schema |       Name       | Type  |  Owner
--------+------------------+-------+---------
 public | accounts         | table | agrisense_user
 public | audit_logs       | table | agrisense_user
 public | user_invitations | table | agrisense_user
 public | user_permissions | table | agrisense_user
```

### 1.3 Backend Build & Run

```bash
# Build backend
cd backend
go build -v ./cmd/agrisense

# Run server (ensure .env configured)
./agrisense --config .env

# Expected output:
# HTTP server starting on port 8080
```

---

## 2. TEST ENVIRONMENT: 4 Personas

### Setup: Create Test Accounts & Users

**Run these SQL commands to set up test data**:

```sql
-- Create Account 1: North Valley Farm (Alice = owner)
INSERT INTO accounts (name, subscription_tier, owner_id, is_active) 
VALUES ('North Valley Farm', 'professional', 1, true) RETURNING id;
-- Note: owner_id=1 should be Alice's user_id (created during registration)

-- Create Account 2: South Valley Farm (Bob = owner) 
INSERT INTO accounts (name, subscription_tier, owner_id, is_active)
VALUES ('South Valley Farm', 'basic', 2, true) RETURNING id;
-- Note: owner_id=2 should be Bob's user_id

-- Assign permissions:
-- Alice = account_owner in Account 1
INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id)
VALUES (1, 1, NULL, 'account_owner', 1);

-- Bob = farm_manager in Account 2
INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id)
VALUES (2, 2, NULL, 'farm_manager', 2);

-- Charlie = operator in Account 1
INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id)
VALUES (3, 1, 1, 'operator', 1);

-- Dave = technician in Account 1
INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id)
VALUES (4, 1, NULL, 'technician', 1);
```

### Persona Reference

| Persona  | Email | Role | Account | Permissions |
|----------|-------|------|---------|-------------|
| **Alice** | alice@example.com | account_owner | North Valley | Can invite, edit roles, revoke, view audit logs |
| **Bob** | bob@example.com | farm_manager | South Valley | Can invite operators/technicians, cannot edit audit logs |
| **Charlie** | charlie@example.com | operator | North Valley | Can view assigned fields, cannot manage team |
| **Dave** | dave@example.com | technician | North Valley | Read-only device management, cannot operate |

---

## 3. API ENDPOINT TESTS

### Test 1: Alice (Account Owner) - Full Access

#### 1.1 Register Alice
```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "Alice123!"
  }'

# Response (keep the token):
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "role": "viewer",
  "account_id": 0,
  "created_at": "2026-05-14T14:00:00Z",
  "updated_at": "2026-05-14T14:00:00Z"
}
```

#### 1.2 Login as Alice
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "Alice123!"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "alice@example.com",
    "account_id": 1
  }
}

# Save token as ALICE_TOKEN
export ALICE_TOKEN="<token>"
```

#### 1.3 List Team Members (Alice can see all users in Account 1)
```bash
curl -X GET http://localhost:8080/api/v1/accounts/1/users \
  -H "Authorization: Bearer $ALICE_TOKEN"

# Expected: Returns users in account 1 + pending invitations
{
  "users": [
    {
      "id": 1,
      "email": "alice@example.com",
      "username": "alice",
      "permissions": [
        {
          "id": 1,
          "role": "account_owner",
          "farm_id": null
        }
      ],
      "created_at": "2026-05-14T14:00:00Z"
    },
    {
      "id": 3,
      "email": "charlie@example.com",
      "username": "charlie",
      "permissions": [
        {
          "id": 3,
          "role": "operator",
          "farm_id": 1
        }
      ],
      "created_at": "2026-05-14T14:10:00Z"
    }
  ],
  "invitations": []
}
```

#### 1.4 Invite New User (Alice invites a new operator)
```bash
curl -X POST http://localhost:8080/api/v1/accounts/1/users/invite \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newoperator@example.com",
    "role": "operator",
    "farm_id": 1
  }'

# Expected: Returns invitation with token
{
  "id": 1,
  "account_id": 1,
  "email": "newoperator@example.com",
  "role": "operator",
  "invitation_token": "a1b2c3d4...",
  "invited_by_id": 1,
  "created_at": "2026-05-14T14:00:00Z",
  "expires_at": "2026-05-21T14:00:00Z"
}
```

#### 1.5 Update User Permission (Alice promotes Charlie to farm_manager)
```bash
curl -X PUT http://localhost:8080/api/v1/accounts/1/users/permission \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "farm_manager"
  }' \
  -G --data-urlencode "permission_id=3"

# Expected: 200 OK
{
  "id": 3,
  "role": "farm_manager"
}
```

#### 1.6 View Audit Log (Alice can see all team actions)
```bash
curl -X GET http://localhost:8080/api/v1/accounts/1/audit \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -G --data-urlencode "resource_type=user_permission" \
  --data-urlencode "action=create" \
  --data-urlencode "limit=10"

# Expected: Returns audit entries filtered by resource_type and action
{
  "logs": [
    {
      "id": 1,
      "account_id": 1,
      "user_id": 1,
      "action": "create",
      "resource_type": "user_permission",
      "resource_id": "3",
      "resource_name": "operator",
      "old_values": null,
      "new_values": {"role": "operator"},
      "status": "success",
      "timestamp": "2026-05-14T14:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

#### 1.7 Revoke User Access (Alice removes Dave's technician role)
```bash
curl -X DELETE http://localhost:8080/api/v1/accounts/1/users/permission \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -G --data-urlencode "permission_id=4"

# Expected: 204 No Content
```

---

### Test 2: Bob (Farm Manager) - Restricted Access

#### 2.1 Login as Bob
```bash
export BOB_TOKEN="<bob's token>"
```

#### 2.2 Bob tries to access Account 2 (his account) - ✅ SHOULD SUCCEED
```bash
curl -X GET http://localhost:8080/api/v1/accounts/2/users \
  -H "Authorization: Bearer $BOB_TOKEN"

# Expected: 200 OK (Bob can see his account's users)
```

#### 2.3 Bob tries to access Account 1 (not his account) - ❌ SHOULD FAIL
```bash
curl -X GET http://localhost:8080/api/v1/accounts/1/users \
  -H "Authorization: Bearer $BOB_TOKEN"

# Expected: 403 Forbidden (tenant isolation enforced)
{
  "error": "Forbidden: Cannot access another account's data"
}
```

#### 2.4 Bob tries to invite users - ✅ SHOULD SUCCEED (he's farm_manager)
```bash
curl -X POST http://localhost:8080/api/v1/accounts/2/users/invite \
  -H "Authorization: Bearer $BOB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "operator@example.com",
    "role": "operator",
    "farm_id": null
  }'

# Expected: 201 Created
```

#### 2.5 Bob tries to view audit logs - ❌ SHOULD FAIL (only account_owner can)
```bash
curl -X GET http://localhost:8080/api/v1/accounts/2/audit \
  -H "Authorization: Bearer $BOB_TOKEN"

# Expected: 403 Forbidden
{
  "error": "Only account owners can view audit logs"
}
```

---

### Test 3: Charlie (Operator) - Read-Only

#### 3.1 Login as Charlie
```bash
export CHARLIE_TOKEN="<charlie's token>"
```

#### 3.2 Charlie tries to list team - ❌ SHOULD FAIL
```bash
curl -X GET http://localhost:8080/api/v1/accounts/1/users \
  -H "Authorization: Bearer $CHARLIE_TOKEN"

# Expected: 403 Forbidden (no permission to manage team)
```

#### 3.3 Charlie tries to access dashboard/data routes - ✅ SHOULD SUCCEED
```bash
# Charlie can view devices in Account 1 (normal protected routes work)
curl -X GET http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $CHARLIE_TOKEN"

# Expected: 200 OK (returns devices filtered by account_id=1)
```

---

### Test 4: Dave (Technician) - Device Management Only

#### 4.1 Login as Dave
```bash
export DAVE_TOKEN="<dave's token>"
```

#### 4.2 Dave tries to operate irrigation - ❌ SHOULD FAIL
```bash
curl -X POST http://localhost:8080/api/v1/devices/1/commands \
  -H "Authorization: Bearer $DAVE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "command_type": "start_irrigation"
  }'

# Expected: 403 Forbidden (no operator permission)
```

#### 4.3 Dave can view device status - ✅ SHOULD SUCCEED
```bash
curl -X GET http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $DAVE_TOKEN"

# Expected: 200 OK (read-only access)
```

---

## 4. VERIFICATION CHECKLIST

### JWT Claims Verification

Check that JWT token includes account_id:

```bash
# Decode token (use JWT.io or jq)
# Token should contain:
{
  "user_id": 1,
  "email": "alice@example.com",
  "account_id": 1,
  "role": "account_owner",
  "iat": 1715689200,
  "exp": 1715775600
}
```

### Tenant Isolation Verification

```bash
# 1. Database level - query with account_id filter
SELECT * FROM devices WHERE account_id = 1;

# 2. Middleware level - verify middleware rejects cross-account requests
# (see Test 2.3 above)

# 3. Repository level - verify all queries filter by account_id
```

### Audit Log Verification

```bash
# Check audit logs were created for all mutations
SELECT action, resource_type, user_id, resource_name, status 
FROM audit_logs 
WHERE account_id = 1 
ORDER BY timestamp DESC;

# Expected entries:
# - create | user_invitation | 1 | newoperator@example.com | success
# - update | user_permission | 1 | ... | success
# - delete | user_permission | 1 | ... | success
```

---

## 5. COMMON ISSUES & FIXES

### Issue 1: "User account not found"
**Cause**: User's account_id is 0 or NULL
**Fix**: Ensure users are assigned to account via user_permissions table before testing

### Issue 2: "Invalid account ID"
**Cause**: account_id in URL doesn't match JWT claim
**Fix**: Verify JWT contains matching account_id; create proper test data

### Issue 3: "Unexpected signing method"
**Cause**: JWT validation failure
**Fix**: Ensure JWT_SECRET environment variable matches backend config

### Issue 4: "Cannot access another account's data"
**Cause**: Tenant isolation enforced correctly
**Status**: ✅ This is expected behavior for cross-account access

---

## 6. FRONTEND TESTING

### Connect Frontend to Backend

1. **Update API base URL** (if different from localhost):
   ```typescript
   // frontend/src/shared/api/client.ts
   const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080/api/v1';
   ```

2. **Login with test users**:
   - Alice (alice@example.com)
   - Bob (bob@example.com)
   - Charlie (charlie@example.com)
   - Dave (dave@example.com)

3. **Verify UI**:
   - ✅ AccountSelector shows current account
   - ✅ RoleBadge displays correct role
   - ✅ TeamManagement shows users in account
   - ✅ AuditLogViewer shows action history
   - ✅ ProtectedRoute denies unauthorized access

---

## 7. DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] Database migration applied successfully
- [ ] JWT claims include account_id
- [ ] TenantIsolationMiddleware active on all protected routes
- [ ] Audit logging working for all mutations
- [ ] RBAC permission checks working
- [ ] Email invitations configured (SMTP)
- [ ] Rate limiting enabled on auth endpoints
- [ ] HTTPS enforced
- [ ] CORS properly configured for frontend domain
- [ ] Monitoring alerts set up for permission errors

---

## 8. NEXT STEPS

1. ✅ Backend routes mounted
2. ✅ JWT updated with account_id
3. ⏳ Run database migration
4. ⏳ Test with 4 personas (see Test 1-4)
5. ⏳ Verify audit logs (see Verification Checklist)
6. ⏳ Frontend integration testing
7. ⏳ Production deployment

---

**Questions or issues?** Refer to:
- FRONTEND_INTEGRATION_CHECKLIST.md (UI integration)
- RBAC_COMPLETION_SUMMARY.md (architecture overview)
- MULTI_TENANT_IMPLEMENTATION.md (technical details)
