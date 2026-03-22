import React, { useEffect, useState } from 'react';
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
import { getAlertRules, createAlertRule } from '../api/devices';

const emptyRule = {
  name: '',
  device_id: '',
  sensor_type_id: 1, // temperature
  condition: '>',
  threshold_value: '',
  duration_seconds: 300,
  severity: 'warning',
  enabled: true,
};

const sensorTypes = [
  { id: 1, name: 'Temperature' },
  { id: 2, name: 'Humidity' },
  { id: 3, name: 'Soil Moisture' },
  { id: 4, name: 'Light Intensity' },
];

const AlertRules = () => {
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
    const res = await getAlertRules();
    if (res.success) {
      setRules(res.data.rules || []);
      setError('');
    } else {
      setError(res.error || 'Unable to load alert rules');
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

  const getSensorName = (id) => {
    return sensorTypes.find(s => s.id === id)?.name || 'Unknown';
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
        <Typography variant="h4" fontWeight={700}>Alert Rules</Typography>
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
          Configure alert rules to monitor sensor thresholds and trigger notifications.
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
                <TableCell>Sensor</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Enabled</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    No alert rules found. Click "Create Rule" to add your first one.
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
        <DialogTitle>{isEditMode ? 'Edit Alert Rule' : 'Create Alert Rule'}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 16, mt: 1 }}>
          <TextField
            label="Rule Name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Device ID (optional)"
            value={form.device_id}
            onChange={(e) => setField('device_id', e.target.value)}
            fullWidth
            helperText="Leave empty to apply to all devices"
          />

          <FormControl fullWidth>
            <InputLabel>Sensor Type</InputLabel>
            <Select
              value={form.sensor_type_id}
              label="Sensor Type"
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
              <InputLabel>Condition</InputLabel>
              <Select
                value={form.condition}
                label="Condition"
                onChange={(e) => setField('condition', e.target.value)}
              >
                <MenuItem value=">">&gt;</MenuItem>
                <MenuItem value="<">&lt;</MenuItem>
                <MenuItem value="=">=</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Threshold Value"
              type="number"
              value={form.threshold_value}
              onChange={(e) => setField('threshold_value', e.target.value)}
              required
              fullWidth
            />
          </Box>

          <TextField
            label="Duration (seconds)"
            type="number"
            value={form.duration_seconds}
            onChange={(e) => setField('duration_seconds', e.target.value)}
            fullWidth
            helperText="How long the condition must be true"
          />

          <FormControl fullWidth>
            <InputLabel>Severity</InputLabel>
            <Select
              value={form.severity}
              label="Severity"
              onChange={(e) => setField('severity', e.target.value)}
            >
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
            </Select>
          </FormControl>

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

export default AlertRules;