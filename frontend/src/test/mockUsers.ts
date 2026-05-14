/**
 * Mock User Data for Frontend Testing
 * These represent the 4 personas for RBAC testing
 */

import type { User, Account, UserPermission } from '@/shared/types/api';

// Alice: Account Owner
export const aliceUser: User = {
  id: 1,
  username: 'alice',
  email: 'alice@farmbiz.com',
  password_hash: 'hashed_password',
  role: 'account_owner',
  account_id: 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

export const aliceAccount: Account = {
  id: 1,
  name: 'Farm Business 1',
  subscription_tier: 'professional',
  owner_id: 1,
  created_at: '2025-01-01T00:00:00Z',
};

export const alicePermissions: UserPermission[] = [
  {
    id: 1,
    user_id: 1,
    account_id: 1,
    farm_id: null,
    role: 'account_owner',
    granted_by_id: 1,
    created_at: '2025-01-01T00:00:00Z',
  },
];

// Bob: Farm Manager
export const bobUser: User = {
  id: 2,
  username: 'bob',
  email: 'bob@farm.com',
  password_hash: 'hashed_password',
  role: 'farm_manager',
  account_id: 1,
  created_at: '2025-02-01T00:00:00Z',
  updated_at: '2025-02-01T00:00:00Z',
};

export const bobPermissions: UserPermission[] = [
  {
    id: 2,
    user_id: 2,
    account_id: 1,
    farm_id: null,
    role: 'farm_manager',
    granted_by_id: 1,
    created_at: '2025-02-01T00:00:00Z',
  },
];

// Charlie: Operator
export const charlieUser: User = {
  id: 3,
  username: 'charlie',
  email: 'charlie@farm.com',
  password_hash: 'hashed_password',
  role: 'operator',
  account_id: 1,
  created_at: '2025-03-01T00:00:00Z',
  updated_at: '2025-03-01T00:00:00Z',
};

export const charliePermissions: UserPermission[] = [
  {
    id: 3,
    user_id: 3,
    account_id: 1,
    farm_id: 1,
    role: 'operator',
    granted_by_id: 2,
    created_at: '2025-03-01T00:00:00Z',
  },
];

// Dave: Technician
export const daveUser: User = {
  id: 4,
  username: 'dave',
  email: 'dave@farm.com',
  password_hash: 'hashed_password',
  role: 'technician',
  account_id: 1,
  created_at: '2025-04-01T00:00:00Z',
  updated_at: '2025-04-01T00:00:00Z',
};

export const davePermissions: UserPermission[] = [
  {
    id: 4,
    user_id: 4,
    account_id: 1,
    farm_id: null,
    role: 'technician',
    granted_by_id: 1,
    created_at: '2025-04-01T00:00:00Z',
  },
];

export const testUsers = {
  alice: { user: aliceUser, account: aliceAccount, permissions: alicePermissions },
  bob: { user: bobUser, account: aliceAccount, permissions: bobPermissions },
  charlie: { user: charlieUser, account: aliceAccount, permissions: charliePermissions },
  dave: { user: daveUser, account: aliceAccount, permissions: davePermissions },
};
