export * from './api';

/* ─── Farm / Field / Zone ─── */
export interface Farm {
  id: number;
  name: string;
  location: string;
  fields: Field[];
}

export interface Field {
  id: number;
  name: string;
  crop?: string;
  area_hectares?: number;
  health: 'healthy' | 'warning' | 'critical';
  soil_moisture?: number;
  temperature?: number;
  humidity?: number;
  last_irrigation?: string;
  latitude?: number;
  longitude?: number;
  zones?: Zone[];
}

export interface Zone {
  id: number;
  name: string;
  soil_moisture: number;
  temperature: number;
  humidity: number;
  status: 'healthy' | 'warning' | 'critical';
  sensors: Sensor2[];
}

export interface Sensor2 {
  id: number;
  device_id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  battery_level?: number;
  last_reading?: import('./api').SensorReading;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertStatus = 'active' | 'acknowledged' | 'investigating' | 'resolved' | 'archived';

export interface Alert2 {
  id: number;
  field_id?: number;
  field_name?: string;
  device_id: string;
  device_name?: string;
  rule_name?: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  confidence?: number;
  recommended_action?: string;
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
}

export interface IrrigationEvent {
  id: number;
  field_id: number;
  zone_id?: number;
  status: 'active' | 'completed' | 'failed' | 'scheduled';
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  water_usage_liters?: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall_mm: number;
  wind_speed: number;
  forecast: 'sunny' | 'cloudy' | 'rainy' | 'storm';
  timestamp: string;
}
