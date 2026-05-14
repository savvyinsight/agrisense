import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import Layout from '@/shared/components/Layout';
import Login from '@/features/auth/Login';
import Dashboard from '@/features/dashboard/Dashboard';
import Fields from '@/features/fields/Fields';
import FieldDetail from '@/features/fields/FieldDetail';
import Alerts from '@/features/alerts/Alerts';
import AlertRules from '@/features/alerts/AlertRules';
import AutomationRules from '@/features/automation/AutomationRules';
import Analytics from '@/features/analytics/Analytics';
import Irrigation from '@/features/irrigation/Irrigation';
import Weather from '@/features/weather/Weather';
import DeviceManagement from '@/features/devices/DeviceManagement';
import MapView from '@/features/devices/MapView';
import Settings from '@/features/settings/Settings';
import Reports from '@/features/reports/Reports';

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                      <Route path="fields" element={<Fields />} />
                      <Route path="fields/:id" element={<FieldDetail />} />
                      <Route path="alerts" element={<Alerts />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="reports" element={<Reports />} />
                      <Route path="map" element={<MapView />} />
                      <Route path="irrigation" element={<Irrigation />} />
                      <Route path="weather" element={<Weather />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="devices" element={<AdminRoute><DeviceManagement /></AdminRoute>} />
                      <Route path="alert-rules" element={<AdminRoute><AlertRules /></AdminRoute>} />
                      <Route path="automation" element={<AdminRoute><AutomationRules /></AdminRoute>} />
                      <Route path="" element={<Navigate to="dashboard" replace />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="max-w-5xl mx-auto py-12 text-center">
      <span className="text-4xl block mb-4">🔍</span>
      <h2 className="text-lg font-bold text-text-primary mb-2">{t('component.pageNotFound')}</h2>
      <p className="text-sm text-text-muted">{t('component.pageNotFoundDesc')}</p>
    </div>
  );
}
