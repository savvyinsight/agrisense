import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import Layout from '@/shared/components/Layout';
import Login from '@/features/auth/Login';
import Dashboard from '@/features/sensors/Dashboard';
import DeviceManagement from '@/features/devices/DeviceManagement';
import AlertRules from '@/features/alerts/AlertRules';
import Alerts from '@/features/alerts/Alerts';
import AutomationRules from '@/features/automation/AutomationRules';
import Analytics from '@/features/analytics/Analytics';
import MapView from '@/features/devices/MapView';

type RouteWrapperProps = {
  children: React.ReactNode;
};

const theme = createTheme({
  palette: {
    primary: {
      main: '#2E7D32',
    },
    secondary: {
      main: '#FFB74D',
    },
    error: {
      main: '#D32F2F',
    },
    background: {
      default: '#F5F5F5',
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
  },
});

const PrivateRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" replace />;

  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <Layout>
                    <Routes>
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="devices" element={
                        <AdminRoute>
                          <DeviceManagement />
                        </AdminRoute>
                      } />
                      <Route path="alerts" element={<Alerts />} />
                      <Route path="alert-rules" element={
                        <AdminRoute>
                          <AlertRules />
                        </AdminRoute>
                      } />
                      <Route path="automation" element={
                        <AdminRoute>
                          <AutomationRules />
                        </AdminRoute>
                      } />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="map" element={<MapView />} />
                      <Route path="" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
