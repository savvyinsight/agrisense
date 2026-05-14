import React, { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Box,
  Typography,
  Chip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  BusinessOutlined as WorkspaceIcon,
  PersonOutlined as OwnerIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import type { Account } from '@/shared/types/api';

interface AccountWithOwnerInfo extends Account {
  isOwner?: boolean;
}

interface AccountSelectorProps {
  accounts?: AccountWithOwnerInfo[];
}

const getSubscriptionColor = (tier: string): 'default' | 'primary' | 'secondary' | 'error' => {
  switch (tier) {
    case 'enterprise':
      return 'error';
    case 'professional':
      return 'primary';
    case 'basic':
    default:
      return 'default';
  }
};

export const AccountSelector: React.FC<AccountSelectorProps> = ({ accounts = [] }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { account, user, setAccount } = useAuth();

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectAccount = (selectedAccount: AccountWithOwnerInfo) => {
    setAccount(selectedAccount);
    handleClose();
  };

  // Fallback: use current account as the only option if no accounts provided
  const accountList = accounts.length > 0 ? accounts : account ? [account] : [];

  if (!account) {
    return null;
  }

  return (
    <Box>
      <Button
        id="account-selector-button"
        aria-controls={open ? 'account-selector-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : 'false'}
        onClick={handleClick}
        startIcon={!isMobile ? <WorkspaceIcon /> : undefined}
        endIcon={<ExpandMoreIcon />}
        sx={{
          textTransform: 'none',
          color: 'text.primary',
          '&:hover': { backgroundColor: 'action.hover' },
        }}
        size={isMobile ? 'small' : 'medium'}
      >
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
              {account.name}
            </Typography>
          </Box>
        )}
      </Button>

      <Menu
        id="account-selector-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        aria-labelledby="account-selector-button"
        PaperProps={{
          sx: { minWidth: isMobile ? 280 : 320 },
        }}
      >
        {accountList.map((acc) => (
          <MenuItem
            key={acc.id}
            onClick={() => handleSelectAccount(acc)}
            selected={account.id === acc.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 1.5,
              px: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {acc.isOwner && (
                  <OwnerIcon
                    sx={{ fontSize: '1rem' }}
                    aria-label="Account owner"
                    title="Account owner"
                  />
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: account.id === acc.id ? 700 : 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {acc.name}
              </Typography>
            </Box>
            <Chip
              label={acc.subscription_tier.charAt(0).toUpperCase() + acc.subscription_tier.slice(1)}
              size="small"
              color={getSubscriptionColor(acc.subscription_tier)}
              variant={account.id === acc.id ? 'filled' : 'outlined'}
              sx={{
                ml: 1,
                flexShrink: 0,
                fontSize: '0.7rem',
              }}
            />
          </MenuItem>
        ))}

        {accountList.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No accounts available
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default AccountSelector;
