import api from './client';

export const getDevices = async (page = 1, limit = 20) => {
  try {
    const response = await api.get(`/devices?page=${page}&limit=${limit}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getDevice = async (id) => {
  try {
    const response = await api.get(`/devices/${id}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getLatestReading = async (deviceId, sensorType = 'temperature') => {
  try {
    // deviceId is the string like "sensor-001",not the numeric ID
    const response = await api.get(`/devices/${deviceId}/data/latest?sensor_type=${sensorType}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getHistoricalData = async (deviceId, sensorType, start, end) => {
  try {
    const response = await api.get(`/devices/${deviceId}/data`, {
      params: {
        sensor_type: sensorType,
        start: start,
        end: end,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};


export const getActiveAlerts = async () => {
  try {
    const response = await api.get('/alerts/active');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const acknowledgeAlert = async (alertId) => {
  try {
    const response = await api.post(`/alerts/${alertId}/acknowledge`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getAlertHistory = async (page = 1, limit = 20) => {
  try {
    const response = await api.get(`/alerts/history?page=${page}&limit=${limit}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const createDevice = async (device) => {
  try {
    const response = await api.post('/devices', device);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const updateDevice = async (id, payload) => {
  try {
    const response = await api.put(`/devices/${id}`, payload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const deleteDevice = async (id) => {
  try {
    await api.delete(`/devices/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getDevicesByStatus = async (page = 1, limit = 20, status = 'online') => {
  try {
    const response = await api.get(`/devices?page=${page}&limit=${limit}&status=${status}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getDevicesDataLatest = async (deviceIds = []) => {
  try {
    if (!deviceIds.length) {
      return { success: true, data: { devices: [] } };
    }
    const response = await api.get(`/devices/data/latest?device_ids=${deviceIds.join(',')}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const createAlertRule = async (rule) => {
  try {
    const response = await api.post('/alerts/rules', rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getAlertRules = async () => {
  try {
    const response = await api.get('/alerts/rules');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const createAutomationRule = async (rule) => {
  try {
    const response = await api.post('/automation/rules', rule);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getAutomationRules = async () => {
  try {
    const response = await api.get('/automation/rules');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const sendCommand = async (deviceId, commandPayload) => {
  try {
    const response = await api.post(`/devices/${deviceId}/commands`, commandPayload);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getCommandStatus = async (deviceId, commandId) => {
  try {
    const response = await api.get(`/devices/${deviceId}/commands/${commandId}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};

export const getAnalyticsReport = async ({ deviceId, start, end, reportType = 'daily' }) => {
  try {
    const response = await api.get('/analytics/report', {
      params: {
        device_id: deviceId,
        start,
        end,
        report_type: reportType,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};