import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import { getAnalyticsReport, getDevices } from '../api/devices';

const Analytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [filters, setFilters] = useState({
    deviceId: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
    reportType: 'daily',
  });

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const loadDevices = async () => {
    setDeviceLoading(true);
    const res = await getDevices();
    if (res.success) {
      setDevices(res.data.devices || []);
    } else {
      setError(res.error || 'Unable to load devices');
    }
    setDeviceLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const generateReport = async () => {
    if (!filters.deviceId) {
      setError(t('analytics.selectDeviceRequired'));
      return;
    }

    // Find the selected device to get its device_id string
    const selectedDevice = devices.find(d => d.id === filters.deviceId);
    if (!selectedDevice) {
      setError(t('analytics.deviceNotFound'));
      return;
    }

    setLoading(true);
    setError('');

    const params = {
      deviceId: selectedDevice.id,
      start: filters.startDate.toISOString(),
      end: filters.endDate.toISOString(),
      reportType: filters.reportType,
    };

    const result = await getAnalyticsReport(params);

    if (result.success) {
      setReportData(result.data);
    } else {
      setError(result.error || 'Failed to generate report');
    }

    setLoading(false);
  };

  const formatChartData = (data) => {
    if (!data || !Array.isArray(data)) return [];

    return data.map((item) => ({
      date: item.date || item.timestamp?.split('T')[0],
      temperature: item.temperature_avg || item.temperature,
      humidity: item.humidity_avg || item.humidity,
      soilMoisture: item.soil_moisture_avg || item.soil_moisture,
      lightIntensity: item.light_intensity_avg || item.light_intensity,
    }));
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
        <AnalyticsIcon sx={{ mr: 2, fontSize: 40 }} />
        <Typography variant="h4" fontWeight={700}>{t('analytics.title')}</Typography>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }} elevation={2}>
        <Typography variant="h6" gutterBottom>{t('analytics.dateRange')}</Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth required>
              <InputLabel>{t('analytics.selectDevice')}</InputLabel>
              <Select
                value={filters.deviceId}
                label={t('analytics.selectDevice')}
                onChange={(e) => handleFilterChange('deviceId', e.target.value)}
                disabled={deviceLoading}
              >
                {devices.map((device) => (
                  <MenuItem key={device.id} value={device.id}>
                    {device.device_id} - {device.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={t('analytics.startDate')}
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={t('analytics.endDate')}
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>{t('analytics.reportType')}</InputLabel>
              <Select
                value={filters.reportType}
                label={t('analytics.reportType')}
                onChange={(e) => handleFilterChange('reportType', e.target.value)}
              >
                <MenuItem value="daily">{t('analytics.daily')}</MenuItem>
                <MenuItem value="weekly">{t('analytics.weekly')}</MenuItem>
                <MenuItem value="monthly">{t('analytics.monthly')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={generateReport}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={20} /> : t('analytics.generateReport')}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {reportData && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Temperature
                  </Typography>
                  <Typography variant="h4">
                    {reportData.temperature?.avg?.toFixed(1) || 'N/A'}°C
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Min: {reportData.temperature?.min?.toFixed(1) || 'N/A'}°C •
                    Max: {reportData.temperature?.max?.toFixed(1) || 'N/A'}°C
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Humidity
                  </Typography>
                  <Typography variant="h4">
                    {reportData.humidity?.avg?.toFixed(1) || 'N/A'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Min: {reportData.humidity?.min?.toFixed(1) || 'N/A'}% •
                    Max: {reportData.humidity?.max?.toFixed(1) || 'N/A'}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Device
                  </Typography>
                  <Typography variant="h6">
                    {reportData.device_name || reportData.device_id || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Period: {filters.startDate.toLocaleDateString()} - {filters.endDate.toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Report Type
                  </Typography>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    {filters.reportType}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Data points: {reportData.daily_data?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {reportData.daily_data && reportData.daily_data.length > 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Temperature Trend</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formatChartData(reportData.daily_data)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="°C" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        stroke="#2E7D32"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Humidity Trend</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={formatChartData(reportData.daily_data)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Bar dataKey="humidity" fill="#1976D2" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Soil Moisture Trend</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={formatChartData(reportData.daily_data)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="soilMoisture"
                        stroke="#ED6C02"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default Analytics;