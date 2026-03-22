import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './store/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DeviceManagement from './pages/DeviceManagement';
import AlertRules from './pages/AlertRules';
import AutomationRules from './pages/AutomationRules';
import Analytics from './pages/Analytics';
import MapView from './pages/MapView';

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

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  return isAdmin() ? children : <Navigate to="/dashboard" />;
};

const ComingSoon = ({ title }) => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h2>{title}</h2>
    <p>This feature is coming soon!</p>
  </div>
);

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
                      <Route path="alerts" element={
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
                      <Route path="" element={<Navigate to="dashboard" />} />
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
