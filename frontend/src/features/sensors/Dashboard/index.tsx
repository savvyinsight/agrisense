import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Box,
  Alert,
  Chip,
  Skeleton,
} from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import DeviceCard from '@/features/devices/DeviceCard';
import SensorChart from '@/features/sensors/SensorChart';
import AlertPanel from '@/features/alerts/AlertPanel';
import { DeviceCardSkeleton } from '@/shared/components/SkeletonLoader';
import { getDevices } from '@/features/devices/api';
import { getLatestReading } from '@/features/sensors/api';
import type { Device, Alert as AlertType, SensorDataMessage, WebSocketMessage } from '@/shared/types/api';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [liveUpdates, setLiveUpdates] = useState<Record<string, number>>({});
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [alertPanelOpen, setAlertPanelOpen] = useState<boolean>(false);
  const [liveAlert, setLiveAlert] = useState<AlertType | null>(null);
  const token = localStorage.getItem('token');

  const handleWebSocketMessage = (data: WebSocketMessage) => {//this function is re-created every single render
    if (data.type !== 'sensor_data') return;
    const message = data as SensorDataMessage;
    console.log('🔵 WebSocket received:', message);
    if (message.type === 'sensor_data') {
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

  const { isConnected } = useWebSocket(token, handleWebSocketMessage);//new reference every render

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {[1, 2, 3].map((i) => (
            <Box key={i}>
              <DeviceCardSkeleton />
            </Box>
          ))}
        </Box>
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
          <Box sx={{ display: 'grid', gap: { xs: 1, sm: 2, md: 3 }, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {devices.map((device) => (
              <Box key={device.id}>
                <DeviceCard
                  device={device}
                  liveTemp={liveUpdates[`${device.device_id}:temperature`]}
                  onClick={() => setSelectedDevice(device)}
                />
              </Box>
            ))}
          </Box>
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
