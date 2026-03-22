import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Collapse,
  Alert,
  Button,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getActiveAlerts, acknowledgeAlert } from '../api/devices';

const AlertPanel = ({ open, onClose, liveAlert }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open]);

  useEffect(() => {
    if (liveAlert) {
      fetchAlerts(); // Refresh when new alert arrives
    }
  }, [liveAlert]);

  const fetchAlerts = async () => {
    setLoading(true);
    const result = await getActiveAlerts();
    if (result.success) {
      const alertsList = result.data.alerts || result.data || [];
      setAlerts(alertsList);
    }
    setLoading(false);
  };

  const handleAcknowledge = async (alertId) => {
    const result = await acknowledgeAlert(alertId);
    if (result.success) {
      setAlerts(alerts.filter(a => a.id !== alertId));
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Collapse in={open}>
      <Card sx={{ mb: 3, bgcolor: '#fff8e7' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Badge badgeContent={alerts.length} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">
                Active Alerts
              </Typography>
            </Box>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {alerts.length === 0 ? (
            <Alert severity="success" icon={<CheckIcon />}>
              No active alerts. All systems normal.
            </Alert>
          ) : (
            <List>
              {alerts.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      {getSeverityIcon(alert.severity)}
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {alert.message || `${alert.rule_name || 'Alert'} triggered`}
                            </Typography>
                            <Chip
                              label={alert.severity}
                              size="small"
                              color={getSeverityColor(alert.severity)}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Device: {alert.device_name || alert.device_id} • 
                            {new Date(alert.triggered_at).toLocaleString()}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      </ListItemSecondaryAction>
                    </Box>
                  </ListItem>
                  {index < alerts.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Collapse>
  );
};

export default AlertPanel;