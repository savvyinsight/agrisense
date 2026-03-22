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