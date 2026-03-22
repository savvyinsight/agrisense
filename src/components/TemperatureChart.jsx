import React, { useEffect, useState } from 'react';
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
import { getHistoricalData } from '../api/devices';

const TemperatureChart = ({ deviceId, deviceName }) => {
  const [timeRange, setTimeRange] = useState('24h');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [deviceId, timeRange]);

  const fetchData = async () => {
    if (!deviceId) return;
    
    setLoading(true);
    
    // Calculate time range
    const end = new Date();
    let start = new Date();
    
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
      'temperature',
      start.toISOString(),
      end.toISOString()
    );

    console.log('Full result:', result);
    console.log('result.data:', result.data);
    
    if (result.success && result.data) {
        // Check if result.data is an array
        const dataArray = Array.isArray(result.data) ? result.data : [];

        // console.log('First item structure',dataArray[0]);//log first item

        // Format for chart
      const formatted = dataArray.map(item => ({        
        time: new Date(item.timestamp).toLocaleString(),
        temperature: item.value,
      }));
      // console.log('Formatted data:', formatted.slice(0, 3));
      setData(formatted);
    } else {
      setError('Failed to load chart data');
      setData([])
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Temperature History - {deviceName}
          </Typography>
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

        {error && (
          <Typography color="error">{error}</Typography>
        )}

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
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
        ) : (
          <Typography color="text.secondary" align="center">
            No temperature data available
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default TemperatureChart;