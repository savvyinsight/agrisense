import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Box,
  Divider,
} from '@mui/material';
import {
  Sensors as SensorIcon,
  PowerOff as OfflineIcon,
  Power as OnlineIcon,
} from '@mui/icons-material';

const DeviceCard = ({ device, liveTemp,onClick }) => {
  const statusColors = {
    online: 'success',
    offline: 'error',
  };

  // Use liveTemp if available, otherwise use stored latestTemp
  const displayTemp = liveTemp !== undefined ? liveTemp : device.latestTemp;

  return (
    <Card 
    sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition:'transform 0.2s',
        '&:hover': onClick ? { transform: 'scale(1.02)', } : {},
      }}
      onClick={onClick}
    >
      
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="div" noWrap>
            {device.name}
          </Typography>
          <Chip
            icon={device.status === 'online' ? <OnlineIcon /> : <OfflineIcon />}
            label={device.status}
            size="small"
            color={statusColors[device.status] || 'default'}
          />
        </Box>

        <Typography color="text.secondary" variant="body2">
          {device.device_id}
        </Typography>
        
        {device.location && (
          <Typography color="text.secondary" variant="body2">
            📍 {device.location}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SensorIcon color="primary" fontSize="small" />
          <Typography variant="body2">
            Temperature: {displayTemp ? `${displayTemp}°C` : 'N/A'}
          </Typography>
          {liveTemp !== undefined && (
            <Chip label="Live" size="small" color="primary" variant="outlined" />
          )}
        </Box>

        {device.last_heartbeat && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Last seen: {new Date(device.last_heartbeat).toLocaleString()}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceCard;