import React from 'react';
import { Box, Card, CardContent, Button, Typography, Container } from '@mui/material';
import { LockOutlined as LockIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/AuthContext';

export const AccessDenied: React.FC<{ message?: string }> = ({
  message,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LockIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />

            <Typography variant="h4" sx={{ fontWeight: 600, mb: 2 }}>
              {t('component.accessDenied')}
            </Typography>

            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
              {message ?? t('component.noPermission')}
            </Typography>

            {user && (
              <Box sx={{ mb: 3, p: 2, backgroundColor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t('component.currentRole', { role: user.role })}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button variant="contained" onClick={() => navigate('/dashboard')}>
                {t('component.returnToDashboard')}
              </Button>
              <Button variant="outlined" onClick={() => navigate(-1)}>
                {t('component.goBack')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default AccessDenied;
