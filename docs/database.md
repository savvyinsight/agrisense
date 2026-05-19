# Database Design

## Overview
We use three databases:
1. **PostgreSQL** - Relational data (users, devices, rules) with PostGIS for geospatial
2. **InfluxDB** - Time-series sensor data
3. **Redis** - Real-time caching and streams

---

## 1. PostgreSQL Schema

### Enable Extensions
```sql
CREATE EXTENSION IF NOT EXISTS postgis;      -- For geospatial queries
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- For password hashing if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- For UUID generation
```

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### Devices Table
```sql
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) UNIQUE NOT NULL,  -- Unique identifier (e.g., ESP32_001)
    name VARCHAR(100) NOT NULL,
    device_type VARCHAR(20) CHECK (device_type IN ('sensor', 'controller', 'both')),
    location_description VARCHAR(255),       -- Field/greenhouse location
    geo_location GEOGRAPHY(POINT),           -- PostGIS spatial point (lat, lon)
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    last_heartbeat TIMESTAMP,
    firmware_version VARCHAR(20),
    config JSONB,                            -- JSONB for flexible device config
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    CONSTRAINT valid_coordinates CHECK (
        geo_location IS NULL OR 
        (ST_Y(geo_location::geometry) BETWEEN -90 AND 90 AND
         ST_X(geo_location::geometry) BETWEEN -180 AND 180)
    )
);

CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_geo ON devices USING GIST(geo_location);
CREATE INDEX idx_devices_config ON devices USING GIN(config);
```

### Sensor Types Table
```sql
CREATE TABLE sensor_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,        -- e.g., 'temperature', 'humidity'
    unit VARCHAR(20),                         -- e.g., '°C', '%'
    min_value FLOAT,
    max_value FLOAT,
    icon VARCHAR(50),                          -- For frontend display
    metadata JSONB                             -- Additional configuration
);

-- Pre-populate
INSERT INTO sensor_types (name, unit, min_value, max_value, icon, metadata) VALUES
('temperature', '°C', -40, 80, 'thermometer', '{"precision": 0.1, "alertable": true}'),
('humidity', '%', 0, 100, 'droplet', '{"precision": 1, "alertable": true}'),
('soil_moisture', '%', 0, 100, 'sprout', '{"precision": 1, "alertable": true}'),
('light_intensity', 'lux', 0, 100000, 'sun', '{"precision": 1, "alertable": false}');
```

### Alert Rules Table
```sql
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,  -- NULL = all devices
    sensor_type_id INTEGER NOT NULL REFERENCES sensor_types(id),
    condition VARCHAR(10) CHECK (condition IN ('>', '<', '=', '>=', '<=', 'between')),
    threshold_value FLOAT,
    threshold_max FLOAT,                        -- For 'between' condition
    duration_seconds INTEGER DEFAULT 0,          -- 0 = immediate
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    CHECK (
        (condition != 'between' AND threshold_value IS NOT NULL) OR
        (condition = 'between' AND threshold_value IS NOT NULL AND threshold_max IS NOT NULL)
    )
);

CREATE INDEX idx_alert_rules_device ON alert_rules(device_id);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
```

### Alerts History Table
```sql
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
    resolved_at TIMESTAMP,
    metadata JSONB                                -- Additional context
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_triggered_at ON alerts(triggered_at);
CREATE INDEX idx_alerts_device ON alerts(device_id);
```

### Control Commands Table
```sql
CREATE TABLE control_commands (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id),
    command VARCHAR(50) NOT NULL,               -- e.g., 'turn_on', 'turn_off', 'set_value'
    parameters JSONB,                             -- e.g., {"duration": 30, "value": 50}
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'sent', 'delivered', 'executed', 'failed')
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    executed_at TIMESTAMP,
    user_id INTEGER REFERENCES users(id),        -- NULL = auto/rule triggered
    metadata JSONB
);

CREATE INDEX idx_commands_status ON control_commands(status);
CREATE INDEX idx_commands_created ON control_commands(created_at);
CREATE INDEX idx_commands_device ON control_commands(device_id);
```

### Automation Rules Table
```sql
CREATE TABLE automation_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    target_device_id INTEGER NOT NULL REFERENCES devices(id),  -- Device to control
    trigger_type VARCHAR(20) CHECK (trigger_type IN ('schedule', 'sensor')),
    
    -- For sensor-based triggers
    trigger_sensor_type_id INTEGER REFERENCES sensor_types(id),
    trigger_condition VARCHAR(5) CHECK (trigger_condition IN ('>', '<', '=', '>=', '<=')),
    trigger_value FLOAT,
    trigger_duration_seconds INTEGER DEFAULT 0,
    
    -- For schedule-based triggers
    schedule_cron VARCHAR(100),                   -- e.g., '0 8 * * *' for 8am daily
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Action to perform
    action_command VARCHAR(50) NOT NULL,
    action_parameters JSONB,
    
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL REFERENCES users(id),
    
    CHECK (
        (trigger_type = 'sensor' AND trigger_sensor_type_id IS NOT NULL) OR
        (trigger_type = 'schedule' AND schedule_cron IS NOT NULL)
    )
);

CREATE INDEX idx_automation_enabled ON automation_rules(enabled);
CREATE INDEX idx_automation_target ON automation_rules(target_device_id);
```

---

## 2. InfluxDB Schema

### Database: `agrisense`

#### Measurement: `sensor_data`
| Tag | Description |
|-----|-------------|
| device_id | Unique device identifier |
| sensor_type | temperature, humidity, etc. |
| location | Optional location tag |

| Field | Type | Description |
|-------|------|-------------|
| value | Float | Sensor reading |
| raw | String | Optional raw data |

**Retention Policy**: 30 days default, then downsampled

**Downsampling Example**:

```sql
-- Create continuous query for hourly averages
CREATE CONTINUOUS QUERY "cq_hourly" ON "agrisense"
BEGIN
    SELECT mean("value") AS "value"
    INTO "hourly_sensor_data"
    FROM "sensor_data"
    GROUP BY time(1h), "device_id", "sensor_type"
END
```

---

## 3. Redis Structure

### Key-Value Patterns

| Purpose | Key Pattern | Value Type | Example |
|---------|-------------|------------|---------|
| Latest reading | `device:latest:{device_id}:{sensor_type}` | String | `{"value":23.5,"time":"2024-..."}` |
| Device status | `device:status:{device_id}` | Hash | `{status:"online", last_seen:timestamp}` |
| Last N readings | `device:recent:{device_id}:{sensor_type}` | List | List of recent readings (size limited) |
| Sliding window | `device:window:{device_id}:{sensor_type}` | Sorted Set | Score=timestamp, Member=value |

### Redis Streams for Real-time Processing
```
Stream: sensor:ingest
  Fields: device_id, sensor_type, value, timestamp

Consumer Groups:
  - rule_engine (for alert processing)
  - data_persister (for InfluxDB storage)
  - websocket_broadcaster (for live UI)
```

---

## 4. Entity Relationship Diagram (Text)

```
┌─────────┐       ┌─────────┐       ┌──────────────┐
│  users  │───────│ devices │───────│ sensor_types │
└─────────┘       └─────────┘       └──────────────┘
     │                 │                    │
     │                 │                    │
     ▼                 ▼                    ▼
┌─────────┐       ┌─────────┐       ┌──────────────┐
│ alert   │       │ control │       │ automation   │
│ rules   │       │ commands│       │ rules        │
└─────────┘       └─────────┘       └──────────────┘
     │
     │
     ▼
┌─────────┐
│ alerts  │
└─────────┘
```

## 5. PostgreSQL Advantages Summary

| Feature | Benefit for AgriSenseIoT |
|---------|-------------------------|
| **PostGIS** | Native geospatial queries for device maps |
| **JSONB** | Flexible device config with indexing |
| **CHECK constraints** | Data integrity at database level |
| **MVCC** | Better concurrency for multiple users |
| **Extensions** | Future extensibility (TimescaleDB, etc.) |
| **Window functions** | Advanced analytics capabilities |
| **Full-text search** | Future search features |

## 6. Partitioning Strategy (Future)

For large tables (alerts, commands):
```sql
-- Example: Partition alerts by month
CREATE TABLE alerts_partitioned (
    LIKE alerts INCLUDING DEFAULTS
) PARTITION BY RANGE (triggered_at);

-- Create monthly partitions
CREATE TABLE alerts_2024_01 PARTITION OF alerts_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```
