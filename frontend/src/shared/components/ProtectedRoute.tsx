import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '@/features/auth/AuthContext';
import usePermission from '@/hooks/usePermission';

interface ProtectedRouteProps {
  component: React.ComponentType<any>;
  requiredRoles?: string[];
  farmId?: number;
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  component: Component,
  requiredRoles = [],
  farmId,
  fallback,
}) => {
  const { user, loading } = useAuth();
  const { can } = usePermission();
  const location = useLocation();

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has required role
  if (requiredRoles.length > 0) {
    const hasPermission = requiredRoles.some((role) => can(role, farmId));

    if (!hasPermission) {
      return fallback ? (
        <Box>{fallback}</Box>
      ) : (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            Access Denied. You do not have permission to view this page.
          </Alert>
        </Box>
      );
    }
  }

  return <Component />;
};

export default ProtectedRoute;
