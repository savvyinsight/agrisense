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
  Collapse,
  Alert,
  Button,
  Badge,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { getActiveAlerts, acknowledgeAlert } from '@/features/alerts/api';
import type { Alert as AlertType } from '@/shared/types/api';

interface AlertPanelProps {
  open: boolean;
  onClose: () => void;
  liveAlert?: AlertType | null;
}

const AlertPanel: React.FC<AlertPanelProps> = ({ open, onClose, liveAlert }) => {
  const [alerts, setAlerts] = useState<AlertType[]>([]);

  useEffect(() => {
    if (open) {
      fetchAlerts();
    }
  }, [open]);

  useEffect(() => {
    if (liveAlert) {
      fetchAlerts();
    }
  }, [liveAlert]);

  const fetchAlerts = async () => {
    const result = await getActiveAlerts();
    if (result.success && result.data) {
      const alertsList = result.data.alerts || [];
      setAlerts(alertsList);
    }
  };

  const handleAcknowledge = async (alertId: number | string) => {
    const result = await acknowledgeAlert(alertId);
    if (result.success) {
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'info';
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
              <Typography variant="h6">Active Alerts</Typography>
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
                              {alert.message || `${(alert as any).rule_name || 'Alert'} triggered`}
                            </Typography>
                            <Chip
                              label={alert.severity}
                              size="small"
                              color={getSeverityColor(alert.severity) as 'default' | 'error' | 'warning' | 'info'}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Device: {(alert as any).device_name || alert.device_id} • {new Date(alert.triggered_at).toLocaleString()}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Button size="small" variant="outlined" onClick={() => handleAcknowledge(alert.id)}>
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