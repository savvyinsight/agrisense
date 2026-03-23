import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { getAlertRules, createAlertRule, getDevices } from '../api/devices';

const emptyRule = {
  name: '',
  device_id: null,
  sensor_type_id: 1, // temperature
  condition: '>',
  threshold_value: '',
  duration_seconds: 300,
  severity: 'warning',
  enabled: true,
};

const AlertRules = () => {
  const { t } = useTranslation();

  const sensorTypes = [
    { id: 1, name: t('alerts.temperature') },
    { id: 2, name: t('alerts.humidity') },
    { id: 3, name: t('alerts.soilMoisture') },
    { id: 4, name: t('alerts.light') },
  ];

  const getSensorName = (id) => {
    return sensorTypes.find(s => s.id === id)?.name || 'Unknown';
  };

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [form, setForm] = useState(emptyRule);
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(true);

  const loadRules = async () => {
    setLoading(true);
    const res = await getAlertRules();
    if (res.success) {
      setRules(res.data.rules || []);
      setError('');
    } else {
      setError(res.error || 'Unable to load alert rules');
    }
    setLoading(false);
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
    loadRules();
    loadDevices();
  }, []);

  const openNew = () => {
    setIsEditMode(false);
    setSelectedRule(null);
    setForm(emptyRule);
    setOpenDialog(true);
  };

  const openEdit = (rule) => {
    setIsEditMode(true);
    setSelectedRule(rule);
    setForm({
      name: rule.name || '',
      device_id: rule.device_id || '',
      sensor_type_id: rule.sensor_type_id || 1,
      condition: rule.condition || '>',
      threshold_value: rule.threshold_value || '',
      duration_seconds: rule.duration_seconds || 300,
      severity: rule.severity || 'warning',
      enabled: rule.enabled !== false,
    });
    setOpenDialog(true);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setError('');
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveRule = async () => {
    if (!form.name || !form.threshold_value) {
      setError('Name and Threshold Value are required');
      return;
    }

    const payload = {
      name: form.name,
      device_id: form.device_id || null,
      sensor_type_id: form.sensor_type_id,
      condition: form.condition,
      threshold_value: parseFloat(form.threshold_value),
      duration_seconds: parseInt(form.duration_seconds),
      severity: form.severity,
      enabled: form.enabled,
    };

    const result = await createAlertRule(payload);

    if (result.success) {
      setSuccess(`Alert rule ${isEditMode ? 'updated' : 'created'} successfully`);
      closeDialog();
      loadRules();
    } else {
      setError(result.error || 'Failed to save alert rule');
    }
  };

  const getDeviceLabel = (deviceId) => {
    if (!deviceId) return t('devices.allDevices');
    const device = devices.find(d => d.id === deviceId);
    return device ? `${device.device_id} - ${device.name}` : 'Unknown Device';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700}>{t('alerts.title')}</Typography>
        <Button
          sx={{ textTransform: 'none' }}
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={openNew}
        >
          {t('alerts.addRule')}
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={2}>
        <Typography variant="body2" color="text.secondary">
          {t('alerts.subtitle')}
        </Typography>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={2} sx={{ mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('alerts.ruleName')}</TableCell>
                <TableCell>{t('devices.deviceId')}</TableCell>
                <TableCell>{t('alerts.temperature')}</TableCell>
                <TableCell>{t('alerts.condition')}</TableCell>
                <TableCell>{t('alerts.severity')}</TableCell>
                <TableCell>{t('alerts.active')}</TableCell>
                <TableCell align="right">{t('devices.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    {t('common.error')}. {t('common.add')} "{t('alerts.addRule')}" {t('common.view').toLowerCase()} {t('common.add')} {t('alerts.ruleName').toLowerCase()}.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{getSensorName(rule.sensor_type_id)}</TableCell>
                    <TableCell>
                      {rule.condition} {rule.threshold_value} for {rule.duration_seconds}s
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rule.severity}
                        size="small"
                        color={getSeverityColor(rule.severity)}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rule.enabled ? 'Enabled' : 'Disabled'}
                        size="small"
                        color={rule.enabled ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton onClick={() => openEdit(rule)} size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error">
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openDialog} fullWidth maxWidth="sm" onClose={closeDialog}>
        <DialogTitle>{isEditMode ? t('alerts.editRule') : t('alerts.addRule')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 16, mt: 1 }}>
          <TextField
            label={t('alerts.ruleName')}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>{t('devices.deviceId')}</InputLabel>
            <Select
              value={form.device_id}
              label={t('devices.deviceId')}
              onChange={(e) => setField('device_id', e.target.value)}
              disabled={deviceLoading}
            >
              <MenuItem value={null}>{t('All Device')}</MenuItem>
              {devices.map((device) => (
                <MenuItem key={device.id} value={device.id}>
                  {device.device_id} - {device.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>{t('alerts.temperature')}</InputLabel>
            <Select
              value={form.sensor_type_id}
              label={t('alerts.temperature')}
              onChange={(e) => setField('sensor_type_id', e.target.value)}
            >
              {sensorTypes.map((sensor) => (
                <MenuItem key={sensor.id} value={sensor.id}>
                  {sensor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 2, alignItems: 'center' }}>
            <FormControl sx={{ minWidth: 80 }}>
              <InputLabel>{t('alerts.condition')}</InputLabel>
              <Select
                value={form.condition}
                label={t('alerts.condition')}
                onChange={(e) => setField('condition', e.target.value)}
              >
                <MenuItem value=">">{t('alerts.greaterThan')}</MenuItem>
                <MenuItem value="<">{t('alerts.lessThan')}</MenuItem>
                <MenuItem value="=">{t('alerts.equals')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('alerts.threshold')}
              type="number"
              value={form.threshold_value}
              onChange={(e) => setField('threshold_value', e.target.value)}
              required
              fullWidth
            />
          </Box>

          <TextField
            label={`${t('common.refresh')} (${t('common.view').toLowerCase()})`}
            type="number"
            value={form.duration_seconds}
            onChange={(e) => setField('duration_seconds', e.target.value)}
            fullWidth
            helperText={t('alerts.condition')}
          />

          <FormControl fullWidth>
            <InputLabel>{t('alerts.severity')}</InputLabel>
            <Select
              value={form.severity}
              label={t('alerts.severity')}
              onChange={(e) => setField('severity', e.target.value)}
            >
              <MenuItem value="info">{t('alerts.low')}</MenuItem>
              <MenuItem value="warning">{t('alerts.medium')}</MenuItem>
              <MenuItem value="critical">{t('alerts.high')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>{t('common.view')}</InputLabel>
            <Select
              value={form.enabled}
              label={t('common.view')}
              onChange={(e) => setField('enabled', e.target.value)}
            >
              <MenuItem value={true}>{t('alerts.active')}</MenuItem>
              <MenuItem value={false}>{t('alerts.inactive')}</MenuItem>
            </Select>
          </FormControl>

          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveRule}>
            {isEditMode ? t('common.edit') : t('common.add')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!success} autoHideDuration={3500} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AlertRules;