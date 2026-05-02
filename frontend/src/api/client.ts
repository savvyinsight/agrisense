import axios, { type AxiosRequestConfig } from 'axios';

const API_BASE = 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: AxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    if (config.headers) {
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    } else {
      config.headers = {
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return config;
});

export default api;
