# AccountSelector Component Setup Guide

## Overview
The `AccountSelector` component is a dropdown menu that allows users to view and switch between accounts they belong to. It's designed for use in the header and is mobile responsive.

**Location**: `frontend/src/features/auth/AccountSelector.tsx`

## Features
✅ Dropdown menu showing current account  
✅ List all accounts user belongs to  
✅ Click to switch account (updates AuthContext)  
✅ Subscription tier badge with color coding  
✅ Account owner indicator with icon  
✅ Mobile responsive (collapse to icon on <768px)  
✅ TypeScript with proper types  
✅ MUI styled with Material-UI components  
✅ Accessible with ARIA labels  
✅ <200 lines of code (165 lines)  

## Integration Guide

### 1. Add to Header Component
```tsx
import { AccountSelector } from '@/features/auth/AccountSelector';
import { useAuth } from '@/features/auth/AuthContext';

export const Header = () => {
  const { user } = useAuth();
  
  // Mock: In production, fetch user's accounts from backend
  const userAccounts = user?.accounts || [];

  return (
    <AppBar>
      <Toolbar>
        <Typography variant="h6">AgrISense</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccountSelector accounts={userAccounts} />
          {/* Other header items */}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
```

### 2. Update AuthContext (if needed)
The component expects the `User` type to potentially have an `accounts` property:

```tsx
// In shared/types/api.ts
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'viewer' | 'account_owner' | 'farm_manager' | 'operator' | 'technician';
  account_id?: number;
  accounts?: Account[];  // Add this for multiple account support
  created_at?: string;
  updated_at?: string;
}
```

### 3. Props Interface
```tsx
interface AccountSelectorProps {
  accounts?: AccountWithOwnerInfo[];
}

interface AccountWithOwnerInfo extends Account {
  isOwner?: boolean;  // Flag to show owner icon
}
```

## Component Details

### Features by Breakpoint

**Desktop (≥768px)**:
- Shows full account name
- Displays workspace icon
- Shows subscription tier chip
- Includes expand icon

**Mobile (<768px)**:
- Shows only workspace icon
- Menu still displays full account info
- Touch-friendly spacing

### Subscription Tier Colors
- **Enterprise**: Error color (red)
- **Professional**: Primary color (blue)
- **Basic**: Default color (gray)

### Icons Used
- **Workspace** (`BusinessOutlined`): Account identifier
- **Person** (`PersonOutlined`): Account owner indicator
- **Expand More** (`ExpandMore`): Menu toggle

## Usage Example

```tsx
import React from 'react';
import { AccountSelector } from '@/features/auth/AccountSelector';
import { useAuth } from '@/features/auth/AuthContext';

export const MyHeader = () => {
  const { account } = useAuth();

  // Example accounts list
  const accounts = [
    {
      id: 1,
      name: 'Main Farm',
      subscription_tier: 'professional',
      owner_id: 1,
      is_active: true,
      isOwner: true,
    },
    {
      id: 2,
      name: 'Secondary Farm',
      subscription_tier: 'basic',
      owner_id: 1,
      is_active: true,
      isOwner: false,
    },
  ];

  return (
    <div>
      <h1>My App</h1>
      <AccountSelector accounts={accounts} />
      {account && <p>Current Account: {account.name}</p>}
    </div>
  );
};
```

## Accessibility
- ✅ ARIA labels on button and menu
- ✅ Keyboard navigation support (built into MUI Menu)
- ✅ Owner indicator has title attribute
- ✅ Proper semantic HTML structure
- ✅ Color + icons for subscription tier (not relying on color alone)

## Future Enhancements

### Phase 2: Backend Integration
```tsx
// Fetch accounts when user logs in
const handleLogin = async (credentials) => {
  const response = await api.login(credentials);
  setUser(response.user);
  setAccount(response.currentAccount);
  // Fetch all accounts user belongs to
  const accounts = await api.getAccounts();
  setUserAccounts(accounts);
};
```

### Phase 2: Account Switching with Permissions
```tsx
// Update switchAccount in AuthContext to:
// 1. Call backend to switch account
// 2. Update permissions for new account
// 3. Refresh relevant data (devices, farms, etc.)
const switchAccount = async (accountId: number) => {
  const response = await api.switchAccount(accountId);
  setAccount(response.account);
  setPermissions(response.permissions);
  // Refetch data for new account context
};
```

## Testing
The component builds successfully with no TypeScript or ESLint errors.

```bash
npm run build  # ✓ Succeeds
```

## Notes
- Component handles empty accounts list gracefully
- Falls back to current account if no accounts provided
- Returns null if no account is available (before login)
- All styling uses MUI theme (customizable)
- No external API calls - updates local AuthContext
