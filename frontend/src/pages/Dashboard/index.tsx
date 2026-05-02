import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Grid,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  Skeleton,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useAuth } from '../../store/AuthContext';
import { useWebSocket } from '../../hooks/useWebSocket';
import DeviceCard from '../../components/DeviceCard';
import SensorChart from '../../components/SensorChart';
import AlertPanel from '../../components/AlertPanel';
import { DeviceCardSkeleton } from '../../components/SkeletonLoader';
import { getDevices, getLatestReading, getActiveAlerts } from '../../api/devices';
import type { Device, Alert as AlertType, SensorDataMessage } from '../../types/api';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [liveUpdates, setLiveUpdates] = useState<Record<string, number>>({});
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [alertPanelOpen, setAlertPanelOpen] = useState<boolean>(false);
  const [liveAlert, setLiveAlert] = useState<AlertType | null>(null);
  const [alerts, setAlerts] = useState<AlertType[]>([]);

  const token = localStorage.getItem('token');

  const handleWebSocketMessage = (data: SensorDataMessage) => {
    console.log('🔵 WebSocket received:', data);
    if (data.type === 'sensor_data') {
      const { device_id, sensor_type, value } = data.payload as {
        device_id: string;
        sensor_type: string;
        value: number;
      };
      setLiveUpdates((prev) => ({
        ...prev,
        [`${device_id}:${sensor_type}`]: value,
      }));

      if (sensor_type === 'temperature' && value > 30) {
        const alertData: AlertType = {
          id: Date.now(),
          device_id,
          message: `🔥 High temperature alert: ${value.toFixed(1)}°C`,
          severity: value > 35 ? 'critical' : 'warning',
          triggered_at: new Date().toISOString(),
        };
        console.log('🚨 Alert detected:', alertData);
        setLiveAlert(alertData);
        setAlertPanelOpen(true);
      }
    }
  };

  const { isConnected } = useWebSocket(token, handleWebSocketMessage);

  useEffect(() => {
    fetchDevices();
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAlerts = async () => {
    const result = await getActiveAlerts();
    if (result.success && result.data) {
      const alertsList = result.data.alerts || [];
      setAlerts(alertsList);
    }
  };

  const fetchDevices = async () => {
    const result = await getDevices();
    if (result.success && result.data) {
      const devicesList = result.data.devices || [];
      const devicesWithData = await Promise.all(
        devicesList.map(async (device) => {
          const reading = await getLatestReading(device.device_id, 'temperature');
          return {
            ...device,
            latestTemp: reading.success && reading.data ? reading.data.value : null,
          };
        })
      );
      setDevices(devicesWithData);
    } else {
      setError('Failed to load devices');
    }
    setLoading(false);
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

        {selectedDevice && (
          <Box sx={{ mt: 4 }}>
            <SensorChart deviceId={selectedDevice.device_id} deviceName={selectedDevice.name} />
          </Box>
        )}

        <AlertPanel open={alertPanelOpen} onClose={() => setAlertPanelOpen(false)} liveAlert={liveAlert} />
      </Container>
    </>
  );
};

export default Dashboard;
