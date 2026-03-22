import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  Skeleton,
  Badge,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { logout } from '../../api/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import DeviceCard from '../../components/DeviceCard';
import SensorChart from '../../components/SensorChart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AlertPanel from '../../components/AlertPanel';
import { DeviceCardSkeleton, ChartSkeleton, AlertSkeleton } from '../../components/SkeletonLoader';
import { getDevices, getLatestReading, getActiveAlerts } from '../../api/devices';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
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
    <Container maxWidth="lg" sx={{ mt: 4 }}>
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
      <AppBar position="static">
        <Toolbar sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
            AgriSenseIoT Dashboard
          </Typography>
          
          <Chip
            icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
            label={isConnected ? 'Live' : 'Offline'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
          
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {user?.username}
          </Typography>
          
          <IconButton color="inherit" size="small" onClick={() => setAlertPanelOpen(!alertPanelOpen)}>
            <Badge badgeContent={alerts?.length || 0} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          
          <IconButton color="inherit" size="small" onClick={handleLogout}>
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Typography variant="h5" gutterBottom>
          Your Devices
        </Typography>

        {devices.length === 0 ? (
          <Alert severity="info">No devices found. Add a device to get started.</Alert>
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