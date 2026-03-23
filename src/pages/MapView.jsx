import React, { useEffect, useState } from 'react';
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
import { getDevicesDataLatest } from '../api/devices';

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
    // First get all devices to get their IDs
    const devicesResult = await getDevicesDataLatest();
    if (devicesResult.success) {
      setDeviceData(devicesResult.data.devices || []);
    } else {
      setError(devicesResult.error || 'Failed to load device locations');
    }
    setLoading(false);
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
          {/* Placeholder for actual map - would integrate Leaflet or Google Maps */}
          <Paper
            sx={{
              height: 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
              backgroundColor: '#f5f5f5',
              border: '2px dashed #ccc',
            }}
            elevation={2}
          >
            <Box sx={{ textAlign: 'center' }}>
              <MapIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                {t('map.deviceLocations')}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {t('map.integrationPlanned')}
              </Typography>
            </Box>
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