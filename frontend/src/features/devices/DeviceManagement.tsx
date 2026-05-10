import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Device } from '@/shared/types/api';
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { getDevices, createDevice, updateDevice, deleteDevice } from '@/features/devices/api';

type DeviceForm = Omit<Device, 'id' | 'created_at' | 'updated_at' | 'latitude' | 'longitude' | 'config'> & {
  latitude: string;
  longitude: string;
  config: {
    reporting_interval: number;
    temperature_unit: 'celsius' | 'fahrenheit';
  };
};

const emptyForm: DeviceForm = {
  device_id: '',
  name: '',
  type: 'sensor',
  location: '',
  status: 'offline',
  latitude: '',
  longitude: '',
  config: {
    reporting_interval: 60,
    temperature_unit: 'celsius',
  },
};

const DeviceManagement = () => {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceForm>(emptyForm);

  const loadDevices = async () => {
    setLoading(true);
    const res = await getDevices();
    if (res.success) {
      setDevices(res.data?.devices || []);
      setError('');
    } else {
      setError(res.error || 'Unable to load devices');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const openNew = () => {
    setIsEditMode(false);
    setSelectedDevice(null);
    setForm(emptyForm);
    setOpenDialog(true);
  };

  const openEdit = (device: Device) => {
    setIsEditMode(true);
    setSelectedDevice(device);
    setForm({
      ...device,
      status: device.status,
      latitude: device.latitude?.toString() ?? '',
      longitude: device.longitude?.toString() ?? '',
      config: {
        reporting_interval: device.config?.reporting_interval ?? 60,
        temperature_unit: (device.config?.temperature_unit as 'celsius' | 'fahrenheit') ?? 'celsius',
      },
    });
    setOpenDialog(true);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setError('');
  };

  const setField = (name: string, value: string | number) => {
    if (name.startsWith('config.')) {
      const key = name.split('.')[1] as keyof DeviceForm['config'];
      setForm((prev: DeviceForm) => ({
        ...prev,
        config: {
          ...prev.config,
          [key]: value,
        },
      }));
      return;
    }

    setForm((prev: DeviceForm) => ({ ...prev, [name]: value }));
  };

  const saveDevice = async () => {
    if (!form.device_id || !form.name) {
      setError('Device ID and Name are required');
      return;
    }

    const payload = {
      device_id: form.device_id,
      name: form.name,
      type: form.type,
      location: form.location,
      latitude: parseFloat(form.latitude) || 0,
      longitude: parseFloat(form.longitude) || 0,
      config: {
        reporting_interval: Number(form.config.reporting_interval) || 60,
        temperature_unit: form.config.temperature_unit,
      },
    };

    const result = selectedDevice?.id && isEditMode
      ? await updateDevice(selectedDevice.id, payload)
      : await createDevice(payload);

    if (result.success) {
      setSuccess(`Device ${isEditMode ? 'updated' : 'added'} successfully`);
      closeDialog();
      loadDevices();
    } else {
      setError(result.error || 'Failed to save device');
    }
  };

  const removeDevice = async (id: number) => {
    const result = await deleteDevice(id);
    if (result.success) {
      setSuccess('Device deleted successfully');
      loadDevices();
    } else {
      setError(result.error || 'Failed to delete device');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight={700}>{t('devices.title')}</Typography>
        <Button
          sx={{ textTransform: 'none' }}
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={openNew}
        >
          {t('devices.addDevice')}
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={2}>
        <Typography variant="body2" color="text.secondary">
          {t('devices.subtitle')}
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
                <TableCell>{t('devices.deviceId')}</TableCell>
                <TableCell>{t('devices.deviceName')}</TableCell>
                <TableCell>{t('devices.deviceType')}</TableCell>
                <TableCell>{t('devices.location')}</TableCell>
                <TableCell>{t('devices.status')}</TableCell>
                <TableCell>{t('common.refresh')}</TableCell>
                <TableCell align="right">{t('devices.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    {t('common.error')}. {t('common.add')} "{t('devices.addDevice')}" {t('common.view').toLowerCase()} {t('common.add')} {t('devices.deviceName').toLowerCase()}.
                  </TableCell>
                </TableRow>
              ) : (
                devices.map((device) => (
                  <TableRow key={device.id || device.device_id} hover>
                    <TableCell>{device.device_id}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.type}</TableCell>
                    <TableCell>{device.location || '-'}</TableCell>
                    <TableCell>{device.status || 'unknown'}</TableCell>
                    <TableCell>{device.config?.reporting_interval || '-'}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton onClick={() => openEdit(device)} size="small">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton onClick={() => removeDevice(device.id)} size="small" color="error">
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
        <DialogTitle>{isEditMode ? t('devices.editDevice') : t('devices.addDevice')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 16, mt: 1 }}>
          <TextField
            label={t('devices.deviceId')}
            value={form.device_id}
            onChange={(e) => setField('device_id', e.target.value)}
            required
            fullWidth
          />
          <TextField
            label={t('devices.deviceName')}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>{t('devices.deviceType')}</InputLabel>
            <Select value={form.type} label={t('devices.deviceType')} onChange={(e) => setField('type', e.target.value)}>
              <MenuItem value="sensor">{t('devices.sensor')}</MenuItem>
              <MenuItem value="controller">{t('devices.controller')}</MenuItem>
              <MenuItem value="both">{t('devices.gateway')}</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label={t('devices.location')}
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            fullWidth
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label="Latitude"
              value={form.latitude}
              onChange={(e) => setField('latitude', e.target.value)}
              fullWidth
            />
            <TextField
              label="Longitude"
              value={form.longitude}
              onChange={(e) => setField('longitude', e.target.value)}
              fullWidth
            />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label={t('devices.firmwareVersion')}
              type="number"
              value={form.config.reporting_interval}
              onChange={(e) => setField('config.reporting_interval', e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('devices.batteryLevel')}</InputLabel>
              <Select
                value={form.config.temperature_unit}
                label={t('devices.batteryLevel')}
                onChange={(e) => setField('config.temperature_unit', e.target.value)}
              >
                <MenuItem value="celsius">Celsius</MenuItem>
                <MenuItem value="fahrenheit">Fahrenheit</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveDevice}>{isEditMode ? t('common.edit') : t('common.add')}</Button>
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

export default DeviceManagement;
