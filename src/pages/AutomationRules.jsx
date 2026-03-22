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
import { getAutomationRules, createAutomationRule } from '../api/devices';

const emptyRule = {
  name: '',
  target_device_id: '',
  trigger_type: 'sensor',
  trigger_sensor_type_id: 1, // temperature
  trigger_condition: '>',
  trigger_value: '',
  trigger_duration_seconds: 60,
  action_command: 'turn_on',
  action_parameters: { duration: 300 },
  enabled: true,
};

const sensorTypes = [
  { id: 1, name: 'Temperature' },
  { id: 2, name: 'Humidity' },
  { id: 3, name: 'Soil Moisture' },
  { id: 4, name: 'Light Intensity' },
];

const commands = [
  { value: 'turn_on', label: 'Turn On' },
  { value: 'turn_off', label: 'Turn Off' },
  { value: 'set_power', label: 'Set Power Level' },
];

const AutomationRules = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [form, setForm] = useState(emptyRule);

  const loadRules = async () => {
    setLoading(true);
    const res = await getAutomationRules();
    if (res.success) {
      setRules(res.data.rules || []);
      setError('');
    } else {
      setError(res.error || 'Unable to load automation rules');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRules();
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
      target_device_id: rule.target_device_id || '',
      trigger_type: rule.trigger_type || 'sensor',
      trigger_sensor_type_id: rule.trigger_sensor_type_id || 1,
      trigger_condition: rule.trigger_condition || '>',
      trigger_value: rule.trigger_value || '',
      trigger_duration_seconds: rule.trigger_duration_seconds || 60,
      action_command: rule.action_command || 'turn_on',
      action_parameters: rule.action_parameters || { duration: 300 },
      enabled: rule.enabled !== false,
    });
    setOpenDialog(true);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    setError('');
  };

  const setField = (name, value) => {
    if (name.startsWith('action_parameters.')) {
      const key = name.split('.')[1];
      setForm((prev) => ({
        ...prev,
        action_parameters: {
          ...prev.action_parameters,
          [key]: value,
        },
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const saveRule = async () => {
    if (!form.name || !form.target_device_id || !form.trigger_value) {
      setError('Name, Target Device, and Trigger Value are required');
      return;
    }

    const payload = {
      name: form.name,
      target_device_id: form.target_device_id,
      trigger_type: form.trigger_type,
      trigger_sensor_type_id: form.trigger_sensor_type_id,
      trigger_condition: form.trigger_condition,
      trigger_value: parseFloat(form.trigger_value),
      trigger_duration_seconds: parseInt(form.trigger_duration_seconds),
      action_command: form.action_command,
      action_parameters: {
        ...form.action_parameters,
        duration: parseInt(form.action_parameters.duration || 300),
        power: parseInt(form.action_parameters.power || 100),
      },
      enabled: form.enabled,
    };

    const result = await createAutomationRule(payload);

    if (result.success) {
      setSuccess(`Automation rule ${isEditMode ? 'updated' : 'created'} successfully`);
      closeDialog();
      loadRules();
    } else {
      setError(result.error || 'Failed to save automation rule');
    }
  };

  const getSensorName = (id) => {
    return sensorTypes.find(s => s.id === id)?.name || 'Unknown';
  };

  const getCommandLabel = (command) => {
    return commands.find(c => c.value === command)?.label || command;
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
        <Typography variant="h4" fontWeight={700}>Automation Rules</Typography>
        <Button
          sx={{ textTransform: 'none' }}
          variant="contained"
          startIcon={<AddCircleIcon />}
          onClick={openNew}
        >
          Create Rule
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }} elevation={2}>
        <Typography variant="body2" color="text.secondary">
          Set up automated actions based on sensor conditions, like irrigation when soil moisture is low.
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
                <TableCell>Name</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Enabled</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    No automation rules found. Click "Create Rule" to add your first one.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((rule) => (
                  <TableRow key={rule.id} hover>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>
                      {getSensorName(rule.trigger_sensor_type_id)} {rule.trigger_condition} {rule.trigger_value}
                      {rule.trigger_duration_seconds > 0 && ` for ${rule.trigger_duration_seconds}s`}
                    </TableCell>
                    <TableCell>
                      {getCommandLabel(rule.action_command)}
                      {rule.action_parameters?.duration && ` for ${rule.action_parameters.duration}s`}
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

      <Dialog open={openDialog} fullWidth maxWidth="md" onClose={closeDialog}>
        <DialogTitle>{isEditMode ? 'Edit Automation Rule' : 'Create Automation Rule'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 16, mt: 1 }}>
          <TextField
            label="Rule Name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Target Device ID"
            value={form.target_device_id}
            onChange={(e) => setField('target_device_id', e.target.value)}
            required
            fullWidth
            helperText="The device that will perform the action"
          />

          <Typography variant="h6" sx={{ mt: 2 }}>Trigger Conditions</Typography>

          <FormControl fullWidth>
            <InputLabel>Sensor Type</InputLabel>
            <Select
              value={form.trigger_sensor_type_id}
              label="Sensor Type"
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
              <InputLabel>Condition</InputLabel>
              <Select
                value={form.trigger_condition}
                label="Condition"
                onChange={(e) => setField('trigger_condition', e.target.value)}
              >
                <MenuItem value=">">&gt;</MenuItem>
                <MenuItem value="<">&lt;</MenuItem>
                <MenuItem value="=">=</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Trigger Value"
              type="number"
              value={form.trigger_value}
              onChange={(e) => setField('trigger_value', e.target.value)}
              required
              fullWidth
            />
          </Box>

          <TextField
            label="Duration (seconds)"
            type="number"
            value={form.trigger_duration_seconds}
            onChange={(e) => setField('trigger_duration_seconds', e.target.value)}
            fullWidth
            helperText="How long the condition must be true before triggering"
          />

          <Typography variant="h6" sx={{ mt: 2 }}>Action</Typography>

          <FormControl fullWidth>
            <InputLabel>Command</InputLabel>
            <Select
              value={form.action_command}
              label="Command"
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
              label="Duration (seconds)"
              type="number"
              value={form.action_parameters.duration}
              onChange={(e) => setField('action_parameters.duration', e.target.value)}
              fullWidth
              helperText="How long to run the action"
            />
            <TextField
              label="Power Level (%)"
              type="number"
              value={form.action_parameters.power}
              onChange={(e) => setField('action_parameters.power', e.target.value)}
              fullWidth
              helperText="Power level for the action"
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={form.enabled}
              label="Status"
              onChange={(e) => setField('enabled', e.target.value)}
            >
              <MenuItem value={true}>Enabled</MenuItem>
              <MenuItem value={false}>Disabled</MenuItem>
            </Select>
          </FormControl>

          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={saveRule}>
            {isEditMode ? 'Update' : 'Create'}
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