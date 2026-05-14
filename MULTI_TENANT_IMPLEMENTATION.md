# Multi-Tenant RBAC Implementation Guide

## Overview

This document describes the multi-tenant, role-based access control (RBAC) system added to AgriSense. This system enables farm businesses to manage their own teams, control user permissions, and maintain compliance through audit logging.

## Architecture

### Database Schema

#### New Tables

1. **accounts** - Represents subscription customers (farm businesses)
   - `id`: Primary key
   - `name`: Business name
   - `subscription_tier`: basic, professional, enterprise
   - `owner_id`: FK to users (account owner)
   - `is_active`: Boolean

2. **user_permissions** - Granular role assignments
   - `id`: Primary key
   - `user_id`: FK to users
   - `account_id`: FK to accounts
   - `farm_id`: FK to farms (nullable = applies to all farms)
   - `role`: account_owner, farm_manager, operator, technician
   - Allows users to have different roles in different farms

3. **user_invitations** - Email-based user invitations
   - `id`: Primary key
   - `account_id`: FK to accounts
   - `email`: Invitation recipient
   - `role`: Invited role
   - `invitation_token`: Unique token for accepting invitation
   - `expires_at`: 7-day expiration
   - `accepted_at`: NULL until accepted

4. **audit_logs** - Compliance tracking
   - `id`: Primary key
   - `account_id`: FK to accounts
   - `user_id`: FK to users
   - `action`: create, read, update, delete
   - `resource_type`: user, device, alert, farm, etc.
   - `old_values`: JSONB of previous state
   - `new_values`: JSONB of new state
   - `ip_address`, `user_agent`: Request metadata

#### Modified Tables

- **users**: Added `account_id` column (FK to accounts)
- **devices**: Added `account_id` column for ownership
- **alert_rules**: Added `account_id` for scoping
- **alerts**: Added `account_id` for scoping
- **automation_rules**: Added `account_id` for scoping
- **control_commands**: Added `account_id` for scoping

### Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| **account_owner** | Subscription account owner | Full control: manage users, invite, change permissions, view audit logs, manage all farms |
| **farm_manager** | Manages specific farm(s) | Can invite operators, control irrigation on assigned farms, view analytics |
| **operator** | Field worker | Can view assigned farms, respond to alerts, start/stop irrigation |
| **technician** | Device maintenance | Can view device health, diagnose connectivity, view all farms for maintenance |

### Tenant Isolation

**Critical Security**: Every API request is filtered by `account_id` at the middleware level.

```go
// Middleware enforces:
- All requests must include account_id in context
- User must belong to that account
- All queries filter by account_id
```

## Backend Implementation

### File Structure

```
backend/internal/
├── user/
│   ├── domain_multi_tenant.go       # New types: Account, UserPermission, etc.
│   ├── account_repo_postgres.go      # Repository implementations
│   ├── handler_multi_tenant.go       # API handlers
│   └── domain.go                     # Updated User type
├── middleware/
│   └── tenant_isolation.go           # Tenant isolation middleware
└── ...
```

### API Endpoints

#### Account Management
- `POST /api/v1/accounts` - Create account (admin only)
- `GET /api/v1/accounts/:id` - Get account details
- `PUT /api/v1/accounts/:id` - Update account

#### User Management
- `POST /api/v1/accounts/:id/users/invite` - Invite user
- `GET /api/v1/accounts/:id/users` - List team members
- `PUT /api/v1/accounts/:id/users/:uid/permission/:pid` - Update role
- `DELETE /api/v1/accounts/:id/users/:uid` - Revoke access

#### Audit Logs
- `GET /api/v1/accounts/:id/audit?resource_type=user&action=create` - Query audit log

### Middleware

```go
// TenantIsolationMiddleware
- Extracts user from context
- Verifies account_id matches user's account
- Rejects cross-account access
- Stores account_id in context for handlers

// PermissionCheckMiddleware(requiredRoles []string)
- Checks if user has required role(s)
- Returns 403 Forbidden if lacking permission

// Helper functions
- GetUserFromContext(r)
- GetAccountIDFromContext(r)
- GetFarmIDFromContext(r)
- GetIPAddressFromContext(r)
```

## Frontend Implementation

### Updated Types

```typescript
// User now includes account_id
interface User {
  id: number;
  username: string;
  email: string;
  role: 'account_owner' | 'farm_manager' | 'operator' | 'technician';
  account_id?: number;
}

// New types
interface Account { ... }
interface UserPermission { ... }
```

### AuthContext Updates

```typescript
// New methods
- hasRole(role: string, farmId?: number): boolean
- hasPermission(role: string, farmId?: number): boolean
- switchAccount(accountId: number): Promise<void>

// Stored in context
- account: Account | null
- permissions: UserPermission[]
```

### usePermission Hook

```typescript
const { can, canInviteUsers, canManageFarm, canOperateIrrigation, canViewAuditLog } = usePermission();

// Usage
if (canInviteUsers()) {
  // Show invite button
}

if (canManageFarm(farmId)) {
  // Enable farm controls
}
```

### TeamManagement Component

Located: `/frontend/src/features/settings/TeamManagement.tsx`

**Features**:
- List team members with their roles
- Invite new users (email-based)
- Update user roles
- Revoke access
- View pending invitations
- Tab-based UI (Team Members / Pending Invitations)

**Access Control**:
- Only account_owner and farm_manager can access

## Migration Strategy

### For Existing Single-User Systems

1. **Create default account** for each admin user
2. **Assign ownership** - Admin becomes account_owner
3. **Migrate roles**:
   - `admin` → `account_owner`
   - `viewer` → `operator`
4. **Set account_id** on all users
5. **Maintain backward compatibility** via JWT token including both old and new role fields

### Data Migration Script

See: `/backend/deployments/init/postgres/002_multi_tenant_rbac.sql`

Automatically:
- Creates accounts for existing admins
- Assigns users to accounts
- Converts old roles to permissions

## Security Considerations

### Tenant Isolation

**How it's enforced**:
1. User retrieves JWT token with `account_id`
2. Middleware extracts user from JWT
3. Middleware verifies user's `account_id` matches request
4. All SQL queries filter by `account_id`
5. Cannot access another account's data

**Tests needed**:
- User A cannot see User B's account data (SQL verification)
- Cross-account API requests return 403 Forbidden
- Audit logs show attempted access violations

### Permission Checking

- Permissions are checked in handlers, not just middleware
- Role checks verify both role name AND farm_id scope
- Account owners cannot be demoted (prevent lockout)

### Audit Logging

All mutations logged:
- WHO: user_id, ip_address, user_agent
- WHAT: action (create/update/delete), resource_type
- WHEN: timestamp
- WHERE: account_id (proves scoping)
- WHY: old_values, new_values

## Testing Checklist

### Unit Tests
- [ ] AccountRepository.CreateAccount
- [ ] PermissionRepository.HasPermission with/without farm_id
- [ ] InvitationRepository.GetInvitationByToken
- [ ] Middleware extracts account_id correctly
- [ ] Middleware rejects cross-account requests

### Integration Tests
- [ ] End-to-end user invitation workflow
- [ ] Role update and permission propagation
- [ ] Audit log captures all mutations
- [ ] Farm manager can only manage assigned farms
- [ ] Operator cannot invite users
- [ ] Technician can view all devices in account

### Security Tests
- [ ] User cannot access other account's farms via direct ID
- [ ] User cannot escalate own role
- [ ] SQL injection attempts on audit log filters
- [ ] Invitation token expires correctly
- [ ] Deleted user's permissions revoked

## Usage Examples

### Inviting a User

```bash
curl -X POST http://localhost:8080/api/v1/accounts/1/users/invite \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "bob@farm.com",
    "role": "farm_manager",
    "farm_id": null
  }'
```

Response:
```json
{
  "id": 42,
  "email": "bob@farm.com",
  "role": "farm_manager",
  "invitation_token": "abc123xyz...",
  "expires_at": "2025-05-21T13:00:00Z"
}
```

### Listing Team Members

```bash
curl http://localhost:8080/api/v1/accounts/1/users \
  -H "Authorization: Bearer JWT_TOKEN"
```

Response:
```json
{
  "users": [
    {
      "id": 1,
      "email": "alice@farm.com",
      "username": "alice",
      "permissions": [
        {
          "id": 1,
          "role": "account_owner",
          "farm_id": null
        }
      ]
    }
  ],
  "invitations": [...]
}
```

### Checking Permissions in Frontend

```typescript
const { canInviteUsers, canManageFarm } = usePermission();

// At account level
if (canInviteUsers()) {
  // Show invite button
}

// For specific farm
if (canManageFarm(farmId)) {
  // Enable farm controls
}
```

## Deployment Notes

1. **Database Migration**: Run `002_multi_tenant_rbac.sql` before deploying new code
2. **API Backward Compatibility**: Keep `/api/v1/*` endpoints, add `/api/v2/*` if major changes
3. **JWT Token**: Should include `account_id` and both old/new roles
4. **Middleware Registration**: Apply `TenantIsolationMiddleware` to all protected routes
5. **Environment Variables**: No new env vars required

## Future Enhancements

1. **Account Subscription Tiers**
   - basic: 1 account_owner, 3 operators
   - professional: 5 users, custom roles
   - enterprise: unlimited

2. **Audit Log Retention Policy**
   - Automatic cleanup of logs older than 90 days
   - Compliance exports (PDF/CSV)

3. **SSO / SAML**
   - Integration with Active Directory
   - Bulk user provisioning

4. **Role Templates**
   - Pre-defined role combinations
   - Custom role creation

5. **Notification on Permission Changes**
   - Email when user is added/removed
   - Slack integration for team events

## References

- SQL Migration: `backend/deployments/init/postgres/002_multi_tenant_rbac.sql`
- Backend Domain: `backend/internal/user/domain_multi_tenant.go`
- Repository: `backend/internal/user/account_repo_postgres.go`
- Handlers: `backend/internal/user/handler_multi_tenant.go`
- Middleware: `backend/internal/middleware/tenant_isolation.go`
- Frontend Hook: `frontend/src/hooks/usePermission.ts`
- Team UI: `frontend/src/features/settings/TeamManagement.tsx`
