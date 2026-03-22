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
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { getDevices, getLatestReading } from '../../api/devices';
import { logout } from '../../api/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import DeviceCard from '../../components/DeviceCard';
import TemperatureChart from '../../components/TemperatureChart';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveUpdates, setLiveUpdates] = useState({});
  // state for selecte device
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Get token for WebSocket
  const token = localStorage.getItem('token');

  // Handle WebSocket messages
  const handleWebSocketMessage = (data) => {
    if (data.type === 'sensor_data') {
      const { device_id, sensor_type, value } = data.payload;
      setLiveUpdates(prev => ({
        ...prev,
        [`${device_id}:${sensor_type}`]: value
      }));
    }
  };

  const { isConnected, send } = useWebSocket(token, handleWebSocketMessage);

  useEffect(() => {
    fetchDevices();
  }, []);

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
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            AgriSenseIoT Dashboard
          </Typography>
          
          {/* WebSocket Status */}
          <Chip
            icon={isConnected ? <WifiIcon /> : <WifiOffIcon />}
            label={isConnected ? 'Live' : 'Offline'}
            color={isConnected ? 'success' : 'error'}
            size="small"
            sx={{ mr: 2 }}
          />
          
          <Typography variant="body1" sx={{ mr: 2 }}>
            {user?.username}
          </Typography>
          <IconButton color="inherit" onClick={handleLogout}>
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
          <Grid container spacing={3}>
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
          <Box sx={{mt:4}}>
            <TemperatureChart
              deviceId={selectedDevice.device_id}
              deviceName={selectedDevice.deviceName}
            />
          </Box>
        )}
      </Container>
    </>
  );
};

export default Dashboard;