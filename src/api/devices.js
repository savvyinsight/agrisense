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
    const response = await api.get(`/devices/${deviceId}/data/latest?sensor_type=${sensorType}`);
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.response?.data?.error };
  }
};