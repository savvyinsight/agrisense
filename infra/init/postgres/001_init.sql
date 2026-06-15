-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices table
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('sensor', 'controller', 'both')),
    location VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_heartbeat TIMESTAMP,
    firmware_version VARCHAR(20),
    config JSONB DEFAULT '{}',
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor types table (predefined)
CREATE TABLE sensor_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    unit VARCHAR(20),
    min_value FLOAT,
    max_value FLOAT,
    icon VARCHAR(50),
    metadata JSONB DEFAULT '{}'
);

-- Insert default sensor types
INSERT INTO sensor_types (name, unit, min_value, max_value, icon) VALUES
('temperature', '°C', -40, 80, 'thermometer'),
('humidity', '%', 0, 100, 'droplet'),
('soil_moisture', '%', 0, 100, 'sprout'),
('light_intensity', 'lux', 0, 100000, 'sun');

-- Alert rules table
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    sensor_type_id INTEGER NOT NULL REFERENCES sensor_types(id),
    condition VARCHAR(10) CHECK (condition IN ('>', '<', '=', '>=', '<=', 'between')),
    threshold_value FLOAT,
    threshold_max FLOAT,
    duration_seconds INTEGER DEFAULT 0,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts history table
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL REFERENCES alert_rules(id),
    device_id INTEGER NOT NULL REFERENCES devices(id),
    sensor_value FLOAT NOT NULL,
    message VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    status VARCHAR(20) DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved')),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Control commands table
CREATE TABLE control_commands (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    command VARCHAR(50) NOT NULL,
    parameters JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'executed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    executed_at TIMESTAMP,
    user_id INTEGER REFERENCES users(id)
);

-- Automation rules table
CREATE TABLE automation_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_device_id INTEGER NOT NULL REFERENCES devices(id),
    trigger_type VARCHAR(20) CHECK (trigger_type IN ('schedule', 'sensor')),
    trigger_sensor_type_id INTEGER REFERENCES sensor_types(id),
    trigger_condition VARCHAR(5) CHECK (trigger_condition IN ('>', '<', '=', '>=', '<=')),
    trigger_value FLOAT,
    trigger_duration_seconds INTEGER DEFAULT 0,
    schedule_cron VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    action_command VARCHAR(50) NOT NULL,
    action_parameters JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);
CREATE INDEX idx_commands_status ON control_commands(status);
CREATE INDEX idx_commands_device_id ON control_commands(device_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- Additional indexes for query performance
-- Composite indexes for common queries
CREATE INDEX idx_devices_user_status ON devices(user_id, status);
CREATE INDEX idx_alerts_device_triggered ON alerts(device_id, triggered_at DESC);
CREATE INDEX idx_commands_device_created ON control_commands(device_id, created_at DESC);

-- Partial index for active alerts
CREATE INDEX idx_alerts_active ON alerts(status) WHERE status = 'triggered';
