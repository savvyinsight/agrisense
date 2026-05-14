# Multi-Tenant RBAC Implementation Checklist

## Pre-Deployment Verification

### Database
- [ ] PostgreSQL 12+ running
- [ ] Backup existing database created
- [ ] Migration script `002_multi_tenant_rbac.sql` reviewed
- [ ] Test on staging database first

### Run Migration
```bash
psql -U postgres -d agrisense < backend/deployments/init/postgres/002_multi_tenant_rbac.sql
```

### Run Verification Queries
```bash
psql -U postgres -d agrisense < backend/deployments/test/multi_tenant_tests.sql
```

Expected results:
- TEST 1: All accounts show with owner emails ✓
- TEST 2: No users with NULL account_id ✓
- TEST 4: No resources with missing account_id ✓
- TEST 14: No broken references ✓

## Backend Integration

### 1. Register Middleware
In your main router setup:
```go
import "agrisense/internal/middleware"

// Apply tenant isolation to all protected routes
router.Use(middleware.TenantIsolationMiddleware)
```

### 2. Mount Handlers
```go
import "agrisense/internal/user"

// Initialize repositories
accountRepo := &user.PostgresAccountRepository{DB: db}
permissionRepo := &user.PostgresPermissionRepository{DB: db}
invitationRepo := &user.PostgresInvitationRepository{DB: db}
auditRepo := &user.PostgresAuditLogRepository{DB: db}

handler := &user.UserHandler{
  UserRepo:       userRepo,
  AccountRepo:    accountRepo,
  PermissionRepo: permissionRepo,
  InvitationRepo: invitationRepo,
  AuditRepo:      auditRepo,
}

// Mount routes
router.Get("/api/v1/accounts/:id", 
  middleware.RequiresAuth,
  handler.GetAccountHandler)

router.Post("/api/v1/accounts/:id/users/invite",
  middleware.RequiresAuth,
  middleware.PermissionCheckMiddleware([]string{"account_owner", "farm_manager"}),
  handler.InviteUserHandler)

router.Get("/api/v1/accounts/:id/users",
  middleware.RequiresAuth,
  handler.ListTeamHandler)

router.Put("/api/v1/accounts/:id/users/:uid/permission/:pid",
  middleware.RequiresAuth,
  handler.UpdateUserPermissionHandler)

router.Delete("/api/v1/accounts/:id/users/:uid",
  middleware.RequiresAuth,
  handler.RevokeUserHandler)

router.Get("/api/v1/accounts/:id/audit",
  middleware.RequiresAuth,
  handler.GetAuditLogHandler)
```

### 3. Update JWT Token
JWT token should include:
```json
{
  "sub": 1,
  "email": "alice@farm.com",
  "account_id": 1,
  "role": "admin",
  "roles": ["account_owner"],
  "permissions": [
    {"role": "account_owner", "farm_id": null}
  ]
}
```

### 4. Test Endpoints
```bash
# Create account
curl -X POST http://localhost:8080/api/v1/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Farm Business 1", "subscription_tier": "professional"}'

# Invite user
curl -X POST http://localhost:8080/api/v1/accounts/1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@farm.com", "role": "farm_manager", "farm_id": null}'

# List team
curl http://localhost:8080/api/v1/accounts/1/users \
  -H "Authorization: Bearer $TOKEN"
```

## Frontend Integration

### 1. Update Type Definitions
✓ Already updated in `frontend/src/shared/types/api.ts`
- User now includes account_id
- Account interface added
- UserPermission interface added

### 2. Update AuthContext
✓ Already updated in `frontend/src/features/auth/AuthContext.tsx`
- New methods: hasRole(), hasPermission(), switchAccount()
- Stores account and permissions
- Maintains backward compatibility

### 3. Use Permission Hook
```typescript
import usePermission from '@/hooks/usePermission';

function MyComponent() {
  const { can, canInviteUsers, canManageFarm } = usePermission();

  if (!can('operator')) {
    return <Alert>Access denied</Alert>;
  }

  return (
    <Button disabled={!canInviteUsers()}>
      Invite User
    </Button>
  );
}
```

### 4. Add Team Management Route
```typescript
import TeamManagement from '@/features/settings/TeamManagement';

// Add to Settings page
<Route path="/settings/team" element={<TeamManagement />} />
```

### 5. Test Frontend
- [ ] Login as account owner
- [ ] Navigate to Settings > Team
- [ ] Invite a user
- [ ] Verify invitation email sent
- [ ] Check pending invitations tab
- [ ] Edit user role
- [ ] Revoke access
- [ ] Mobile responsive check

## Testing Matrix

### Unit Tests (Backend)

Create `backend/internal/user/handler_multi_tenant_test.go`:

```go
func TestInviteUserHandler(t *testing.T) {
  // Arrange
  mockAccountRepo := &MockAccountRepository{}
  mockPermissionRepo := &MockPermissionRepository{}
  mockInvitationRepo := &MockInvitationRepository{}
  
  handler := &UserHandler{
    AccountRepo:    mockAccountRepo,
    PermissionRepo: mockPermissionRepo,
    InvitationRepo: mockInvitationRepo,
  }
  
  // Act
  // ... test invitation workflow
  
  // Assert
  // ... verify invitation created
}

func TestTenantIsolation(t *testing.T) {
  // Arrange - Create users in different accounts
  user1 := createUser("alice@farm1.com", accountID: 1)
  user2 := createUser("bob@farm2.com", accountID: 2)
  
  // Act - user1 tries to access user2's data
  response := getTeam(user1, accountID: 2)
  
  // Assert - Should be forbidden
  if response.StatusCode != 403 {
    t.Fatal("Expected 403, got", response.StatusCode)
  }
}
```

### Integration Tests

```bash
# Start app with test database
go test -v ./internal/user -run TestIntegration
```

### SQL Tests

```bash
# Run from psql
psql -U postgres -d agrisense_test < backend/deployments/test/multi_tenant_tests.sql
```

## Security Verification

### 1. Tenant Isolation Test
```sql
-- User A tries to see User B's farms
SELECT * FROM devices 
WHERE account_id = 2 AND user_id = 1;
-- Should return 0 rows or error
```

### 2. Permission Boundary Test
```sql
-- Operator tries to access admin function
-- Should fail at middleware level
```

### 3. Audit Trail Verification
```sql
SELECT * FROM audit_logs 
WHERE action = 'delete' AND resource_type = 'user_permission'
ORDER BY created_at DESC LIMIT 5;
```

## Monitoring

### Post-Deployment Checks (First 24 hours)

```bash
# Monitor error rate
tail -f /var/log/agrisense/error.log

# Check audit logs
psql -c "SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour';"

# Verify no access violations
psql -c "SELECT * FROM audit_logs WHERE status = 'failure';"
```

### Metrics to Track

- [ ] Auth success rate (>99%)
- [ ] Permission check latency (<50ms)
- [ ] Tenant isolation violations (0)
- [ ] Audit log entries created per hour
- [ ] API response times for team management

## Rollback Plan

If critical issues found:

```bash
# Backup current state
pg_dump agrisense > backup_with_rbac.sql

# Revert migration
psql -d agrisense < backend/deployments/init/postgres/rollback_002.sql

# Redeploy previous backend version
# Restart app
```

Note: No rollback script included yet. Create before deployment:
```sql
-- rollback_002.sql
DROP TABLE audit_logs;
DROP TABLE user_invitations;
DROP TABLE user_permissions;
DELETE FROM accounts;
ALTER TABLE users DROP COLUMN account_id;
-- ... revert other column additions
```

## Success Criteria

✓ All users successfully authenticated
✓ Team management page loads without errors
✓ Can invite new user via email
✓ Permission changes take effect immediately
✓ Cross-account access blocked (403 Forbidden)
✓ Audit logs show all team actions
✓ Mobile UI responsive
✓ No database errors in logs

## Support Contact

For issues:
1. Check audit_logs table for error details
2. Review application error logs
3. Run verification queries in `multi_tenant_tests.sql`
4. Contact backend team with:
   - User account_id
   - Operation attempted
   - Timestamp
   - Error message from logs
