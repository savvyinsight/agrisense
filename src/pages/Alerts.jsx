import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Snackbar,
  TablePagination,
} from '@mui/material';
import {
  CheckCircle as AcknowledgeIcon,
  DoneAll as ResolveIcon,
  NotificationsActive as AlertsIcon,
} from '@mui/icons-material';
import { getActiveAlerts, acknowledgeAlert, resolveAlert, getAlertHistory } from '../api/devices';

const Alerts = () => {
  const { t } = useTranslation();
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [resolveDialog, setResolveDialog] = useState({ open: false, alert: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Pagination state
  const [activePage, setActivePage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalActive, setTotalActive] = useState(0);
  const [totalHistory, setTotalHistory] = useState(0);

  useEffect(() => {
    loadAlerts();
  }, [tabValue, activePage, historyPage, rowsPerPage]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        const result = await getActiveAlerts(activePage + 1, rowsPerPage);
        if (result.success) {
          const data = result.data;
          setActiveAlerts(data.alerts || data || []);
          setTotalActive(data.total || data.length || 0);
        }
      } else {
        const result = await getAlertHistory(historyPage + 1, rowsPerPage);
        if (result.success) {
          const data = result.data;
          setAlertHistory(data.alerts || data || []);
          setTotalHistory(data.total || data.length || 0);
        }
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
    setLoading(false);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Reset pagination when switching tabs
    if (newValue === 0) {
      setHistoryPage(0);
    } else {
      setActivePage(0);
    }
  };

  const handleActivePageChange = (event, newPage) => {
    setActivePage(newPage);
  };

  const handleHistoryPageChange = (event, newPage) => {
    setHistoryPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setActivePage(0);
    setHistoryPage(0);
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const result = await acknowledgeAlert(alertId);
      if (result.success) {
        setActiveAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
        setTotalActive((prevTotal) => Math.max(prevTotal - 1, 0));
        setSnackbar({ open: true, message: t('alerts.acknowledgeSuccess'), severity: 'success' });
        if (tabValue === 1) loadAlerts();
      } else {
        setSnackbar({ open: true, message: t('alerts.acknowledgeError'), severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('alerts.acknowledgeError'), severity: 'error' });
    }
  };

  const handleResolve = async () => {
    const alert = resolveDialog.alert;
    if (!alert) return;

    try {
      const result = await resolveAlert(alert.id);
      if (result.success) {
        setActiveAlerts((prev) => prev.filter((a) => a.id !== alert.id));
        setTotalActive((prevTotal) => Math.max(prevTotal - 1, 0));
        setSnackbar({ open: true, message: t('alerts.resolveSuccess'), severity: 'success' });
        if (tabValue === 1) loadAlerts();
      } else {
        setSnackbar({ open: true, message: t('alerts.resolveError'), severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('alerts.resolveError'), severity: 'error' });
    }
    setResolveDialog({ open: false, alert: null });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Container maxWidth="xl">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <AlertsIcon sx={{ mr: 2, fontSize: 40 }} />
        <Typography variant="h4" fontWeight={700}>
          {t('alerts.title')}
        </Typography>
      </Box>

      <Paper sx={{ mb: 3 }} elevation={2}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label={`${t('alerts.activeAlerts')} (${totalActive})`} />
          <Tab label={`${t('alerts.alertHistory')} (${totalHistory})`} />
        </Tabs>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={2}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('alerts.severity')}</TableCell>
                <TableCell>{t('alerts.message')}</TableCell>
                <TableCell>{t('devices.deviceName')}</TableCell>
                <TableCell>{t('alerts.triggeredAt')}</TableCell>
                <TableCell>{tabValue === 0 ? t('alerts.status') : t('alerts.acknowledgedAt')}</TableCell>
                <TableCell align="right">{t('devices.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(tabValue === 0 ? activeAlerts : alertHistory).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <Typography variant="body1" color="text.secondary">
                      {tabValue === 0 ? t('alerts.noActiveAlerts') : t('alerts.noAlertHistory')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (tabValue === 0 ? activeAlerts : alertHistory).map((alert) => (
                  <TableRow key={alert.id} hover>
                    <TableCell>
                      <Chip
                        label={`${getSeverityIcon(alert.severity)} ${alert.severity}`}
                        size="small"
                        color={getSeverityColor(alert.severity)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {alert.message || `${alert.rule_name || 'Alert'} triggered`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {alert.device_name || alert.device_id}
                    </TableCell>
                    <TableCell>
                      {formatDate(alert.triggered_at)}
                    </TableCell>
                    <TableCell>
                    {tabValue === 0 ? (
                      <Chip label={t('alerts.active')} color="error" size="small" />
                    ) : (
                      <Chip
                        label={alert.status === 'resolved' ? t('alerts.resolved') : t('alerts.acknowledged')}
                        color={alert.status === 'resolved' ? 'success' : 'warning'}
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {tabValue === 0 && (
                      <>
                        <Tooltip title={t('alerts.acknowledge')}>
                          <IconButton
                            onClick={() => handleAcknowledge(alert.id)}
                            color="primary"
                            size="small"
                          >
                            <AcknowledgeIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('alerts.resolve')}>
                          <IconButton
                            onClick={() => setResolveDialog({ open: true, alert })}
                            color="success"
                            size="small"
                          >
                            <ResolveIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={tabValue === 0 ? totalActive : totalHistory}
            page={tabValue === 0 ? activePage : historyPage}
            onPageChange={tabValue === 0 ? handleActivePageChange : handleHistoryPageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </Paper>
      )}

      {/* Resolve Confirmation Dialog */}
      <Dialog open={resolveDialog.open} onClose={() => setResolveDialog({ open: false, alert: null })}>
        <DialogTitle>{t('alerts.confirmResolve')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('alerts.resolveConfirmMessage')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialog({ open: false, alert: null })}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleResolve} color="success" variant="contained">
            {t('alerts.resolve')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Alerts;