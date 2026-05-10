import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import { getAnalyticsReport } from '@/features/analytics/api';
import { getDevices } from '@/features/devices/api';
import type { Device } from '@/shared/types/api';
import type { AnalyticsReport } from '@/shared/types/api';

const Analytics = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState<AnalyticsReport | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [filters, setFilters] = useState({
    deviceId: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
    reportType: 'daily',
  });

  const handleFilterChange = (field: string, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const loadDevices = async () => {
    setDeviceLoading(true);
    const res = await getDevices();
    if (res.success && res.data) {
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
    const selectedDevice = devices.find(d => d.id === Number(filters.deviceId));
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

    if (result.success && result.data) {
      setReportData(result.data);
    } else {
      setError(result.error || 'Failed to generate report');
    }

    setLoading(false);
  };

  const getSensorDataByType = (sensorType: string) => {
    if (!reportData?.sensor_reports) return null;
    return reportData.sensor_reports.find(s => s.sensor_type === sensorType);
  };

  const calculateAverages = (sensorData: any) => {
    if (!sensorData?.data || sensorData.data.length === 0) {
      return { avg: 0, min: 0, max: 0 };
    }
    const values = sensorData.data.map((d: any) => d.avg);
    const mins = sensorData.data.map((d: any) => d.min);
    const maxs = sensorData.data.map((d: any) => d.max);
    
    return {
      avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
      min: Math.min(...mins),
      max: Math.max(...maxs),
    };
  };

  const formatChartData = (sensorType: string) => {
    const sensorData = getSensorDataByType(sensorType);
    if (!sensorData?.data || !Array.isArray(sensorData.data)) return [];

    return sensorData.data.map((item: any) => ({
      date: item.timestamp?.split('T')[0],
      avg: item.avg,
      min: item.min,
      max: item.max,
      count: item.count,
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
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 1 }}>
          <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
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
          </Box>
          <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={t('analytics.startDate')}
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Box>
          <Box sx={{ minWidth: 150, flex: '1 1 auto' }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label={t('analytics.endDate')}
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                  },
                }}
              />
            </LocalizationProvider>
          </Box>
          <Box sx={{ minWidth: 200, flex: '1 1 auto' }}>
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
          </Box>
        </Box>
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box sx={{ minWidth: 250, flex: '1 1 auto' }}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Temperature
                  </Typography>
                  <Typography variant="h4">
                    {calculateAverages(getSensorDataByType('temperature')).avg.toFixed(1)}°C
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Min: {calculateAverages(getSensorDataByType('temperature')).min.toFixed(1)}°C •
                    Max: {calculateAverages(getSensorDataByType('temperature')).max.toFixed(1)}°C
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ minWidth: 250, flex: '1 1 auto' }}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Average Humidity
                  </Typography>
                  <Typography variant="h4">
                    {calculateAverages(getSensorDataByType('humidity')).avg.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Min: {calculateAverages(getSensorDataByType('humidity')).min.toFixed(1)}% •
                    Max: {calculateAverages(getSensorDataByType('humidity')).max.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ minWidth: 250, flex: '1 1 auto' }}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Device
                  </Typography>
                  <Typography variant="h6">
                    {reportData.device_uid || reportData.device_id || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Period: {filters.startDate.toLocaleDateString()} - {filters.endDate.toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ minWidth: 250, flex: '1 1 auto' }}>
              <Card elevation={2}>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Report Type
                  </Typography>
                  <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                    {filters.reportType}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Data points: {getSensorDataByType('temperature')?.data?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Box>

          {reportData.sensor_reports && reportData.sensor_reports.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Temperature Trend</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={formatChartData('temperature')}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="°C" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#2E7D32"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Box>
              <Box sx={{ flex: '1 1 50%', minWidth: 300 }}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Humidity Trend</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={formatChartData('humidity')}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Bar dataKey="avg" fill="#1976D2" />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Box>
              <Box sx={{ flex: '1 1 50%', minWidth: 300 }}>
                <Paper sx={{ p: 3 }} elevation={2}>
                  <Typography variant="h6" gutterBottom>Soil Moisture Trend</Typography>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={formatChartData('soil_moisture')}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit="%" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="#ED6C02"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Box>
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default Analytics;