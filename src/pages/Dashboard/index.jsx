import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Skeleton,
  Badge,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAuth } from '../../store/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import DeviceCard from '../../components/DeviceCard';
import SensorChart from '../../components/SensorChart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AlertPanel from '../../components/AlertPanel';
import { DeviceCardSkeleton, ChartSkeleton, AlertSkeleton } from '../../components/SkeletonLoader';
import { getDevices, getLatestReading, getActiveAlerts } from '../../api/devices';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveUpdates, setLiveUpdates] = useState({});
  // state for selecte device
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [liveAlert, setLiveAlert] = useState(null);
  const [alerts, setAlerts] = useState([]);

  // Get token for WebSocket
  const token = localStorage.getItem('token');

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    console.log('🔵 WebSocket received:', data);
    if (data.type === 'sensor_data') {
      const { device_id, sensor_type, value } = data.payload;
      setLiveUpdates(prev => ({
        ...prev,
        [`${device_id}:${sensor_type}`]: value
      }));
      
      // Detect temperature alerts (>30°C)
      if (sensor_type === 'temperature' && value > 30) {
        const alertData = {
          id: Date.now(),
          device_id: device_id,
          message: `🔥 High temperature alert: ${value.toFixed(1)}°C`,
          severity: value > 35 ? 'critical' : 'warning',
          triggered_at: new Date().toISOString()
        };
        console.log('🚨 Alert detected:', alertData);
        setLiveAlert(alertData);
        setAlertPanelOpen(true);
      }
    }
  };

  const { isConnected, send } = useWebSocket(token, handleWebSocketMessage);

  useEffect(() => {
    fetchDevices();
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
  const result = await getActiveAlerts();
  if (result.success) {
    const alertsList = result.data.alerts || result.data || [];
    setAlerts(alertsList);
  }
};

  const fetchDevices = async () => {
    const result = await getDevices();
    if (result.success) {
      const devicesList = result.data.devices || result.data || [];
      
      // Fetch latest reading for each device
      const devicesWithData = await Promise.all(
        devicesList.map(async (device) => {
          const reading = await getLatestReading(device.device_id, 'temperature');
          return {
            ...device,
            latestTemp: reading.success ? reading.data.value : null,
          };
        })
      );
      setDevices(devicesWithData);
    } else {
      setError('Failed to load devices');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    navigate('/login');
  };

  if (loading) {
  return (
    <Container maxWidth="lg">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>
      <Grid container spacing={3}>
        {[1, 2, 3].map((i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <DeviceCardSkeleton />
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('dashboard.title')}
        </Typography>
        <Chip
          icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
          label={isConnected ? t('common.view') : t('devices.offline')}
          color={isConnected ? 'success' : 'error'}
          size="small"
        />
      </Box>

      <Container maxWidth="lg">
        {error && <Alert severity="error">{error}</Alert>}

        <Typography variant="h5" gutterBottom>
          {t('dashboard.deviceHealth')}
        </Typography>

        {devices.length === 0 ? (
          <Alert severity="info">{t('devices.title')} - {t('common.add')} {t('devices.deviceName').toLowerCase()} {t('common.view').toLowerCase()}.</Alert>
        ) : (
          <Grid container spacing={{ xs: 1, sm: 2, md: 3 }}>
            {devices.map((device) => (
              <Grid item xs={12} sm={6} md={4} key={device.id}>
                <DeviceCard 
                  device={device} 
                  liveTemp={liveUpdates[`${device.device_id}:temperature`]}
                  onClick={() => setSelectedDevice(device)}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Chart Section*/}
        {selectedDevice && (
          <Box sx={{ mt: 4 }}>
            <SensorChart 
              deviceId={selectedDevice.device_id}
              deviceName={selectedDevice.name}
            />
          </Box>
        )}

        <AlertPanel 
          open={alertPanelOpen} 
          onClose={() => setAlertPanelOpen(false)}
          liveAlert={liveAlert}
        />
      </Container>
    </>
  );
};

export default Dashboard;