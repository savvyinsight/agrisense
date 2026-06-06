import React from 'react';
import { Box, Chip, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/AuthContext';

const getRoleLabel = (role: string, t: (key: string) => string): string => {
  const labels: { [key: string]: string } = {
    admin: t('teamManagement.accountOwner'),
    viewer: 'Viewer',
    account_owner: t('teamManagement.accountOwner'),
    farm_manager: t('teamManagement.farmManager'),
    operator: t('teamManagement.operator'),
    technician: t('teamManagement.technician'),
  };
  return labels[role] || role;
};

const getRoleColor = (role: string): any => {
  const colors: { [key: string]: any } = {
    admin: 'error',
    account_owner: 'error',
    farm_manager: 'warning',
    operator: 'info',
    viewer: 'info',
    technician: 'success',
  };
  return colors[role] || 'default';
};

export const RoleBadge: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, account } = useAuth();

  if (!user || !account) return null;

  const roleLabel = getRoleLabel(user.role, t);
  const fullText = `${user.username} (${roleLabel}) — ${account.name}`;

  if (isMobile) {
    return (
      <Tooltip title={fullText}>
        <Chip
          label={user.username.charAt(0).toUpperCase()}
          color={getRoleColor(user.role)}
          variant="outlined"
          size="small"
          sx={{ height: 32 }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={t('auth.currentRoleAccount')}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 0 }}>
        <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>
          {user.username}
        </Typography>
        <Chip
          label={roleLabel}
          color={getRoleColor(user.role)}
          variant="outlined"
          size="small"
          sx={{ height: 28, fontSize: '0.8rem' }}
        />
      </Box>
    </Tooltip>
  );
};

export default RoleBadge;
