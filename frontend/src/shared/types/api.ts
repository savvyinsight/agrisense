// API Response Types
export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'viewer' | 'account_owner' | 'farm_manager' | 'operator' | 'technician';
  account_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Account {
  id: number;
  name: string;
  subscription_tier: 'basic' | 'professional' | 'enterprise';
  owner_id: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserPermission {
  id: number;
  user_id: number;
  account_id: number;
  farm_id?: number;
  role: string;
  granted_by_id: number;
  created_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginResponse {
  success: boolean;
  data?: AuthResponse;
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  data?: AuthResponse;
  error?: string;
}

// Device Types
export interface Device {
  id: number;
  device_id: string;
  name: string;
  type: string;
  status: 'online' | 'offline';
  location: string;
  latitude?: number;
  longitude?: number;
  config?: DeviceConfig;
  latestTemp?: number | null;
  last_heartbeat?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceConfig {
  reporting_interval: number;
  temperature_unit: 'celsius' | 'fahrenheit';
}

export interface DevicesResponse {
  success: boolean;
  data?: {
    devices: Device[];
    total?: number;
    page?: number;
    limit?: number;
  };
  error?: string;
}

// Sensor Reading Types
export interface SensorReading {
  value: number;
  unit?: string;
  timestamp?: string;
  sensor_type?: string;
}

export interface SensorReadingResponse {
  success: boolean;
  data?: SensorReading;
  error?: string;
}

export interface HistoricalData {
  timestamp: string;
  value: number;
  [key: string]: string | number;
}

export interface HistoricalDataResponse {
  success: boolean;
  data?: HistoricalData[];
  error?: string;
}

// Alert Types
export interface Alert {
  id: number;
  device_id: string;
  device_name?: string;
  rule_name?: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  status?: 'active' | 'acknowledged' | 'resolved';
  triggered_at: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

export interface AlertsResponse {
  success: boolean;
  data?: {
    alerts: Alert[];
    total?: number;
  };
  error?: string;
}

export interface AlertRule {
  id?: number;
  name: string;
  device_id: number | null;
  sensor_type_id: number;
  condition: string;
  threshold_value: number | string;
  duration_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  created_at?: string;
}

export interface AlertRulesResponse {
  success: boolean;
  data?: {
    rules: AlertRule[];
    total?: number;
  };
  error?: string;
}

// Automation Types
export interface AutomationRule {
  id?: number;
  name: string;
  target_device_id: number;
  trigger_type: string;
  trigger_sensor_type_id: number;
  trigger_condition: string;
  trigger_value: number | string;
  trigger_duration_seconds: number;
  action_command: string;
  action_parameters: Record<string, unknown>;
  enabled: boolean;
  created_at?: string;
}

export interface AutomationRulesResponse {
  success: boolean;
  data?: {
    rules: AutomationRule[];
    total?: number;
  };
  error?: string;
}

// WebSocket Types
export interface WebSocketMessage {
  type: string;
  payload: unknown;
}

export interface SensorDataMessage extends WebSocketMessage {
  type: 'sensor_data';
  payload: {
    device_id: string;
    sensor_type: string;
    value: number;
    timestamp: string;
  };
}

// Analytics Types
export interface AnalyticsReport {
  device_id?: string;
  device_uid?: string;
  sensor_reports: SensorReport[];
  summary?: {
    min?: number;
    max?: number;
    average?: number;
    total?: number;
  };
}

export interface SensorReport {
  sensor_type: string;
  data: HistoricalData[];
}

export interface AnalyticsResponse {
  success: boolean;
  data?: AnalyticsReport;
  error?: string;
}
