import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getHistoricalData } from '@/features/sensors/api';
import SensorSelector from './SensorSelector';

interface SensorChartProps {
  deviceId: string;
  deviceName: string;
}

interface ChartDataPoint {
  time: string;
  value: number;
}

const SensorChart: React.FC<SensorChartProps> = ({ deviceId, deviceName }) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [sensorType, setSensorType] = useState('temperature');
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sensorUnits: Record<string, string> = {
    temperature: '°C',
    humidity: '%',
    soil_moisture: '%',
    light_intensity: 'lux',
  };

  const sensorLabels: Record<string, string> = {
    temperature: 'Temperature',
    humidity: 'Humidity',
    soil_moisture: 'Soil Moisture',
    light_intensity: 'Light Intensity',
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, sensorType, timeRange]);

  const fetchData = async () => {
    if (!deviceId) return;

    setLoading(true);
    setError('');

    const end = new Date();
    const start = new Date(end);
    switch (timeRange) {
      case '24h':
        start.setHours(end.getHours() - 24);
        break;
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      default:
        start.setHours(end.getHours() - 24);
    }

    const result = await getHistoricalData(
      deviceId,
      sensorType,
      start.toISOString(),
      end.toISOString()
    );

    if (result.success && result.data) {
      const dataArray = Array.isArray(result.data) ? result.data : [];
      const formatted = dataArray.map((item) => ({
        time: new Date(item.timestamp).toLocaleString(),
        value: item.value,
      }));
      setData(formatted);
    } else {
      setError('No data available');
      setData([]);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h6">
            {sensorLabels[sensorType]} History - {deviceName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <SensorSelector selected={sensorType} onSelect={setSensorType} />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <MenuItem value="24h">Last 24 Hours</MenuItem>
                <MenuItem value="7d">Last 7 Days</MenuItem>
                <MenuItem value="30d">Last 30 Days</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {error && <Typography color="error">{error}</Typography>}

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis unit={sensorUnits[sensorType]} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2E7D32" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography color="text.secondary" align="center">
            No {sensorLabels[sensorType]} data available
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default SensorChart;