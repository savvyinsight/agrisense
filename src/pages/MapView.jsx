import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { getDevicesDataLatest, getDevices } from '../api/devices';

// Fix Leaflet icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MapView = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deviceData, setDeviceData] = useState([]);

  useEffect(() => {
    loadDeviceLocations();
  }, []);

  const loadDeviceLocations = async () => {
    setLoading(true);
    setError('');
    try {
      // First get all devices to get their IDs
      const devicesResult = await getDevices();
      if (!devicesResult.success) {
        setError(devicesResult.error || 'Failed to load devices');
        setLoading(false);
        return;
      }

      const devices = devicesResult.data.devices || [];
      if (devices.length === 0) {
        setDeviceData([]);
        setLoading(false);
        return;
      }

      // Extract device IDs
      const deviceIds = devices.map(d => d.id);

      // Get latest readings for all devices
      const readingsResult = await getDevicesDataLatest(deviceIds);
      if (readingsResult.success) {
        // Merge device info with latest readings
        const readingsData = readingsResult.data.devices || readingsResult.data || [];
        const enrichedData = devices.map(device => {
          let latestData = null;
          
          // Handle different response structures
          if (Array.isArray(readingsData)) {
            latestData = readingsData.find(d => d.device_id === device.device_id);
          } else if (typeof readingsData === 'object' && readingsData[device.device_id]) {
            latestData = readingsData[device.device_id];
          }
          
          return {
            ...device,
            ...(latestData || {}),
          };
        });
        setDeviceData(enrichedData);
      } else {
        setError(readingsResult.error || 'Failed to load device readings');
      }
    } catch (err) {
      setError('An error occurred while loading device locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <MapIcon sx={{ mr: 2, fontSize: 40 }} />
        <Typography variant="h4" fontWeight={700}>{t('map.title')}</Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={2}>
        <Typography variant="body2" color="text.secondary">
          {t('map.subtitle')}
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Interactive Leaflet Map */}
          <Paper
            sx={{
              height: 500,
              mb: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
            elevation={2}
          >
            {deviceData.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <MapIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                  <Typography variant="h6" color="textSecondary">
                    {t('map.noDevicesWithLocation')}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <MapContainer
                center={[
                  deviceData[0]?.latitude || 0,
                  deviceData[0]?.longitude || 0,
                ]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {deviceData.map((device) => (
                  device.latitude && device.longitude && (
                    <Marker
                      key={device.device_id}
                      position={[device.latitude, device.longitude]}
                    >
                      <Popup>
                        <Box sx={{ minWidth: 200 }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {device.name || device.device_id}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                            📍 {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                          </Typography>
                          {device.readings && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" fontWeight={600} display="block">
                                {t('map.liveReadings')}
                              </Typography>
                              {Object.entries(device.readings).map(([sensor, value]) => (
                                <Typography key={sensor} variant="caption">
                                  {t(`alerts.${sensor}`)}: {value}
                                  {sensor === 'temperature'
                                    ? '°C'
                                    : sensor === 'humidity'
                                      ? '%'
                                      : ''}
                                </Typography>
                              ))}
                            </Box>
                          )}
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                            {device.last_update
                              ? new Date(device.last_update).toLocaleString()
                              : 'Never'}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
            )}
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            {t('map.deviceLocationsLiveData')}
          </Typography>

          {deviceData.length === 0 ? (
            <Alert severity="info">
              {t('map.noDevicesWithLocation')}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {deviceData.map((device) => (
                <Grid item xs={12} md={6} lg={4} key={device.device_id}>
                  <Card elevation={2}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6">{device.name || device.device_id}</Typography>
                      </Box>

                      {device.latitude && device.longitude ? (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                          📍 {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                          📍 {t('map.locationNotSet')}
                        </Typography>
                      )}

                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {t('map.lastUpdateLabel')} {device.last_update ? new Date(device.last_update).toLocaleString() : 'Never'}
                      </Typography>

                      {device.readings && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                            {t('map.liveReadings')}
                          </Typography>
                          {Object.entries(device.readings).map(([sensor, value]) => (
                            <Box key={sensor} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                                {t(`alerts.${sensor}`)}:
                              </Typography>
                              <Chip
                                label={`${value}${sensor === 'temperature' ? '°C' : sensor === 'humidity' ? '%' : ''}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default MapView;