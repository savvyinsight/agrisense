import { useEffect, useState } from 'react';
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
import { getAutomationRules, createAutomationRule, deleteAutomationRule } from '@/features/automation/api';
import { getDevices } from '@/features/devices/api';
import type { AutomationRule, Device } from '@/shared/types/api';

type AutomationActionParameters = {
  duration: number;
  power: number;
};

type AutomationForm = Omit<AutomationRule, 'id' | 'action_parameters' | 'trigger_value'> & {
  trigger_value: string;
  action_parameters: AutomationActionParameters;
};

const emptyRule: AutomationForm = {
  name: '',
  target_device_id: 0,
  trigger_type: 'sensor',
  trigger_sensor_type_id: 1, // temperature
  trigger_condition: '>',
  trigger_value: '',
  trigger_duration_seconds: 60,
  action_command: 'turn_on',
  action_parameters: { duration: 300, power: 100 },
  enabled: true,
};

const AutomationRules = () => {
  const { t } = useTranslation();
  // Add all these state declarations:
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState<AutomationForm>(emptyRule);

  const sensorTypes = [
    { id: 1, name: t('alertRules.temperature') },
    { id: 2, name: t('alertRules.humidity') },
    { id: 3, name: t('alertRules.soilMoisture') },
    { id: 4, name: t('alertRules.light') },
  ];

  const commands = [
    { value: 'turn_on', label: t('automation.turnOn') },
    { value: 'turn_off', label: t('automation.turnOff') },
    { value: 'set_power', label: t('automation.setValue') },
  ];

  const loadRules = async () => {
    setLoading(true);
    const res = await getAutomationRules();
    if (res.success) {
      setRules(res.data?.rules || []);
      setError('');
    } else {
      setError(res.error || 'Unable to load automation rules');
    }
    setLoading(false);
  };

  const loadDevices = async () => {
    setDeviceLoading(true);
    const res = await getDevices();
    if (res.success) {
      setDevices(res.data?.devices || []);
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
    setForm(emptyRule);
    setOpenDialog(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setIsEditMode(true);
    setForm({
      name: rule.name,
      target_device_id: rule.target_device_id,
      trigger_type: rule.trigger_type,
      trigger_sensor_type_id: rule.trigger_sensor_type_id,
      trigger_condition: rule.trigger_condition,
      trigger_value: typeof rule.trigger_value === 'number' ? rule.trigger_value.toString() : rule.trigger_value || '',
      trigger_duration_seconds: rule.trigger_duration_seconds,
      action_command: rule.action_command,
      action_parameters: {
        duration: typeof rule.action_parameters?.duration === 'number' ? rule.action_parameters.duration : 300,
        power: typeof rule.action_parameters?.power === 'number' ? rule.action_parameters.power : 100,
      },
      enabled: rule.enabled,
    });
    setOpenDialog(true);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setError('');
  };

  const setField = (name: string, value: string | number | boolean) => {
    if (name.startsWith('action_parameters.')) {
      const key = name.split('.')[1] as keyof AutomationActionParameters;
      setForm((prev: AutomationForm) => ({
        ...prev,
        action_parameters: {
          ...prev.action_parameters,
          [key]: Number(value),
        },
      }));
      return;
    }

    setForm((prev: AutomationForm) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveRule = async () => {
    if (!form.name || !form.trigger_value) {
      setError(t('automation.validationError'));
      return;
    }

    const payload = {
      name: form.name,
      target_device_id: form.target_device_id,
      trigger_type: form.trigger_type,
      trigger_sensor_type_id: form.trigger_sensor_type_id,
      trigger_condition: form.trigger_condition,
      trigger_value: parseFloat(form.trigger_value),
      trigger_duration_seconds: Number(form.trigger_duration_seconds),
      action_command: form.action_command,
      action_parameters: {
        ...form.action_parameters,
        duration: Number(form.action_parameters.duration || 300),
        power: Number(form.action_parameters.power || 100),
      },
      enabled: form.enabled,
    };

    const result = await createAutomationRule(payload);

    if (result.success) {
      setSuccess(isEditMode ? t('automation.ruleUpdated') : t('automation.ruleCreated'));
      closeDialog();
      loadRules();
    } else {
      setError(result.error || t('automation.saveRuleError'));
    }
  };

  const deleteRule = async (ruleId: number) => {
    if (!window.confirm(t('common.confirm') + ' ' + t('automation.deleteRule') + '?')) {
      return;
    }

    const result = await deleteAutomationRule(ruleId);
    if (result.success) {
      setSuccess(t('automation.deleteRule') + ' ' + t('common.success'));
      loadRules();
    } else {
      setError(result.error || t('automation.deleteRule') + ' ' + t('common.error'));
    }
  };

  const getSensorName = (id: number) => {
    return sensorTypes.find(s => s.id === id)?.name || 'Unknown';
  };

  const getCommandLabel = (command: string) => {
    return commands.find(c => c.value === command)?.label || command;
  };

  const getDeviceLabel = (deviceId: number) => {
    if (deviceId === 0) return t('devices.allDevices');
    const device = devices.find(d => d.id === deviceId);
    return device ? `${device.device_id} - ${device.name}` : 'Unknown Device';
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
        <Typography variant="h4" fontWeight={700}>{t('automation.title')}</Typography>
        <Button
          sx={{ textTransform: 'none' }}
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={openNew}
        >
          {t('automation.addRule')}
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={2}>
        <Typography variant="body2" color="text.secondary">
          {t('automation.subtitle')}
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
                <TableCell>{t('automation.trigger')}</TableCell>
                <TableCell>{t('automation.action')}</TableCell>
                <TableCell>{t('automation.enabled')}</TableCell>
                <TableCell align="right">{t('devices.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    {t('automation.noRulesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>{getDeviceLabel(rule.target_device_id)}</TableCell>
                    <TableCell>
                      {getSensorName(rule.trigger_sensor_type_id)} {rule.trigger_condition} {rule.trigger_value}
                      {rule.trigger_duration_seconds > 0 && ` for ${rule.trigger_duration_seconds}s`}
                    </TableCell>
                    <TableCell>
                      {getCommandLabel(rule.action_command)}
                      {typeof rule.action_parameters?.duration === 'number' && ` for ${rule.action_parameters.duration}s`}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rule.enabled ? t('automation.enabled') : t('automation.disabled')}
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
                        <IconButton onClick={() => deleteRule(rule.id ?? 0)} size="small" color="error">
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

      <Dialog open={openDialog} fullWidth maxWidth="md" onClose={closeDialog}>
        <DialogTitle>{isEditMode ? t('automation.editRule') : t('automation.addRule')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 16, mt: 1 }}>
          <TextField
            label={t('automation.ruleName')}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>{t('devices.targetDevice')}</InputLabel>
            <Select
              value={form.target_device_id}
              label={t('devices.targetDevice')}
              onChange={(e) => setField('target_device_id', e.target.value)}
              disabled={deviceLoading}
            >
              <MenuItem value={0}>{t('devices.allDevices')}</MenuItem>
              {devices.map((device) => (
                <MenuItem key={device.id} value={device.id}>
                  {`${device.device_id} — ${device.name}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="h6" sx={{ mt: 2 }}>{t('automation.triggerConditions')}</Typography>

          <FormControl fullWidth>
            <InputLabel>{t('devices.deviceType')}</InputLabel>
            <Select
              value={form.trigger_sensor_type_id}
              label={t('devices.deviceType')}
              onChange={(e) => setField('trigger_sensor_type_id', e.target.value)}
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
              <InputLabel>{t('alertRules.condition')}</InputLabel>
              <Select
                value={form.trigger_condition}
                label={t('alertRules.condition')}
                onChange={(e) => setField('trigger_condition', e.target.value)}
              >
                <MenuItem value=">">&gt;</MenuItem>
                <MenuItem value="<">&lt;</MenuItem>
                <MenuItem value="=">=</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('alertRules.threshold')}
              type="number"
              value={form.trigger_value}
              onChange={(e) => setField('trigger_value', e.target.value)}
              required
              fullWidth
            />
          </Box>

          <TextField
            label={t('automation.durationSeconds')}
            type="number"
            value={form.trigger_duration_seconds}
            onChange={(e) => setField('trigger_duration_seconds', e.target.value)}
            fullWidth
            helperText={t('automation.triggerDurationHelper')}
          />

          <Typography variant="h6" sx={{ mt: 2 }}>{t('automation.actionHeading')}</Typography>

          <FormControl fullWidth>
            <InputLabel>{t('automation.action')}</InputLabel>
            <Select
              value={form.action_command}
              label={t('automation.action')}
              onChange={(e) => setField('action_command', e.target.value)}
            >
              {commands.map((cmd) => (
                <MenuItem key={cmd.value} value={cmd.value}>
                  {cmd.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField
              label={t('automation.actionDuration')}
              type="number"
              value={form.action_parameters.duration}
              onChange={(e) => setField('action_parameters.duration', e.target.value)}
              fullWidth
              helperText={t('automation.actionDurationHelper')}
            />
            <TextField
              label={t('automation.powerLevel')}
              type="number"
              value={form.action_parameters.power}
              onChange={(e) => setField('action_parameters.power', e.target.value)}
              fullWidth
              helperText={t('automation.powerLevelHelper')}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>{t('common.status')}</InputLabel>
            <Select
              value={String(form.enabled)}
              label={t('common.status')}
              onChange={(e) => setField('enabled', e.target.value === 'true')}
            >
              <MenuItem value="true">{t('automation.enabled')}</MenuItem>
              <MenuItem value="false">{t('automation.disabled')}</MenuItem>
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

export default AutomationRules;