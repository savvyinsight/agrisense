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
  data?: AuthResponse & {
    account?: Account;
    permissions?: UserPermission[];
  };
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
  field_id?: number | null;
  user_id?: number | null;
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
  status: 'triggered' | 'acknowledged' | 'resolved';
  triggered_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertsResponse {
  success: boolean;
  data?: {
    alerts: Alert[];
    total?: number;
  };
  error?: string;
}

export interface TrendCondition {
  direction: 'increasing' | 'decreasing';
  percentage: number;
  window_minutes: number;
}

export interface AlertRule {
  id?: number;
  name: string;
  device_id: number | null;
  field_id?: number | null;
  sensor_type_id: number;
  condition: string;
  threshold_value: number | string;
  threshold_max?: number | string | null;
  duration_seconds: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  recovery_threshold_value?: number | string | null;
  recovery_condition?: string | null;
  trend_condition?: TrendCondition | null;
  auto_escalation_enabled?: boolean;
  auto_escalation_minutes?: number;
  auto_escalation_severity?: 'warning' | 'critical';
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
export type CommandStatus = 'pending' | 'sent' | 'delivered' | 'executed' | 'failed';

export interface Command {
  id: number;
  device_id: number;
  command: string;
  parameters?: Record<string, unknown>;
  status: CommandStatus;
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  executed_at?: string;
  user_id?: number;
  metadata?: Record<string, unknown>;
}

export interface AutomationRule {
  id?: number;
  name: string;
  target_device_id: number;
  trigger_type: string;
  trigger_sensor_type_id: number;
  trigger_condition: string;
  trigger_value: number | string;
  trigger_duration_seconds: number;
  schedule_cron?: string | null;
  timezone?: string;
  action_command: string;
  action_parameters: Record<string, unknown>;
  enabled: boolean;
  paused?: boolean;
  last_triggered_at?: string | null;
  execution_count?: number;
  last_command_status?: CommandStatus;
  last_command_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationRulesResponse {
  success: boolean;
  data?: {
    rules: AutomationRule[];
    total?: number;
  };
  error?: string;
}

export interface AutomationExecution {
  id: number;
  rule_id: number;
  rule_name: string;
  device_id: number;
  device_name?: string;
  command: string;
  status: CommandStatus;
  triggered_by: 'sensor' | 'schedule' | 'manual';
  triggered_at: string;
  completed_at?: string;
}

export interface FieldAutomationSummary {
  field_id: number;
  field_name: string;
  active_rules: number;
  total_executions_today: number;
  last_execution_status?: CommandStatus;
  last_execution_at?: string;
}

export interface AutomationDashboardData {
  total_rules: number;
  active_rules: number;
  paused_rules: number;
  failed_rules: number;
  recent_executions: AutomationExecution[];
  field_summaries: FieldAutomationSummary[];
  global_automation_enabled: boolean;
}

export interface AutomationDashboardResponse {
  success: boolean;
  data?: AutomationDashboardData;
  error?: string;
}

// Notification Types
export interface NotificationChannel {
  id: number;
  type: 'email' | 'sms' | 'webhook';
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  created_at?: string;
}

export interface NotificationRoutingRule {
  id: number;
  severity: 'info' | 'warning' | 'critical';
  channel_ids: number[];
  enabled: boolean;
}

export interface NotificationSettings {
  channels: NotificationChannel[];
  routing_rules: NotificationRoutingRule[];
}

export interface NotificationSettingsResponse {
  success: boolean;
  data?: NotificationSettings;
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

// Irrigation Types
export interface IrrigationZone {
  id: number;
  name: string;
  field_id: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  target_moisture: number;
  current_moisture?: number;
  status: 'idle' | 'running' | 'error';
  last_run?: string;
  created_at?: string;
}

export interface IrrigationEvent {
  id: number;
  field_id: number;
  zone_id: number;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  start_time: string;
  end_time?: string;
  duration_minutes: number;
  water_usage_liters: number;
  trigger_type?: 'manual' | 'schedule' | 'rule';
}

export interface IrrigationResponse {
  zones: IrrigationZone[];
  total: number;
}

// Escalation Types
export interface EscalationLevel {
  delay_minutes: number;
  severity: 'info' | 'warning' | 'critical';
  channel_ids: number[];
}

export interface EscalationRule {
  id: number;
  name: string;
  trigger_severity: 'info' | 'warning' | 'critical';
  levels: EscalationLevel[];
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EscalationRulesResponse {
  success: boolean;
  data?: {
    rules: EscalationRule[];
    total?: number;
  };
  error?: string;
}

export interface EscalationHistoryEntry {
  id: number;
  alert_id: number;
  rule_id: number;
  level_index: number;
  severity: string;
  channels_notified: number[];
  triggered_at: string;
}

export interface EscalationHistoryResponse {
  success: boolean;
  data?: EscalationHistoryEntry[];
  error?: string;
}
