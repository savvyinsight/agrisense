# API Design

## Base Information
- **Base URL**: `/api/v1`
- **Format**: JSON
- **Authentication**: JWT (Bearer token)
- **Real-time Updates**: WebSocket for live data

---

## Authentication Endpoints

### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
    "username": "farmer_john",
    "email": "john@example.com",
    "password": "securepassword"
}

Response 201 Created
{
    "id": 1,
    "username": "farmer_john",
    "email": "john@example.com",
    "role": "viewer",
    "created_at": "2024-03-08T10:00:00Z"
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "email": "john@example.com",
    "password": "securepassword"
}

Response 200 OK
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 86400,
    "user": {
        "id": 1,
        "username": "farmer_john",
        "email": "john@example.com",
        "role": "viewer"
    }
}
```

---

## Device Management

### Register New Device
```http
POST /api/v1/devices
Authorization: Bearer <token>
Content-Type: application/json

{
    "device_id": "esp32_sensor_001",      // Unique hardware ID
    "name": "Greenhouse North Sensor",
    "type": "sensor",                      // sensor, controller, both
    "location": "Greenhouse A - North",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "config": {
        "reporting_interval": 60,          // seconds
        "temperature_unit": "celsius",
        "thresholds": {
            "temperature_max": 35,
            "humidity_min": 30
        }
    }
}

Response 201 Created
{
    "id": 101,
    "device_id": "esp32_sensor_001",
    "name": "Greenhouse North Sensor",
    "status": "offline",
    "created_at": "2024-03-08T10:05:00Z"
}
```

### List All Devices
```http
GET /api/v1/devices?page=1&limit=20&status=online
Authorization: Bearer <token>

Response 200 OK
{
    "total": 150,
    "page": 1,
    "limit": 20,
    "devices": [
        {
            "id": 101,
            "device_id": "esp32_sensor_001",
            "name": "Greenhouse North Sensor",
            "type": "sensor",
            "status": "online",
            "last_heartbeat": "2024-03-08T10:10:30Z",
            "location": "Greenhouse A - North"
        }
    ]
}
```

### Get Device Details
```http
GET /api/v1/devices/101
Authorization: Bearer <token>

Response 200 OK
{
    "id": 101,
    "device_id": "esp32_sensor_001",
    "name": "Greenhouse North Sensor",
    "type": "sensor",
    "location": "Greenhouse A - North",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "status": "online",
    "last_heartbeat": "2024-03-08T10:10:30Z",
    "firmware_version": "1.2.0",
    "config": {
        "reporting_interval": 60,
        "temperature_unit": "celsius"
    },
    "created_at": "2024-03-08T10:05:00Z",
    "updated_at": "2024-03-08T10:06:00Z"
}
```

### Update Device
```http
PUT /api/v1/devices/101
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "Updated Sensor Name",
    "location": "Greenhouse B - South",
    "config": {
        "reporting_interval": 30
    }
}

Response 200 OK
{
    "id": 101,
    "name": "Updated Sensor Name",
    "location": "Greenhouse B - South",
    "updated_at": "2024-03-08T10:15:00Z"
}
```

### Delete Device
```http
DELETE /api/v1/devices/101
Authorization: Bearer <token>

Response 204 No Content
```

---

## Sensor Data

### Get Latest Readings
```http
GET /api/v1/devices/101/latest
Authorization: Bearer <token>

Response 200 OK
{
    "device_id": 101,
    "readings": [
        {
            "sensor_type": "temperature",
            "value": 23.5,
            "unit": "°C",
            "timestamp": "2024-03-08T10:16:30Z"
        },
        {
            "sensor_type": "humidity",
            "value": 65,
            "unit": "%",
            "timestamp": "2024-03-08T10:16:30Z"
        }
    ]
}
```

### Get Historical Data
```http
GET /api/v1/devices/101/data?sensor_type=temperature&start=2024-03-01T00:00:00Z&end=2024-03-08T00:00:00Z&aggregation=hour&format=json
Authorization: Bearer <token>

Response 200 OK
{
    "device_id": 101,
    "sensor_type": "temperature",
    "unit": "°C",
    "data": [
        {
            "timestamp": "2024-03-01T00:00:00Z",
            "value": 22.1
        },
        {
            "timestamp": "2024-03-01T01:00:00Z",
            "value": 21.8
        }
    ]
}
```

### Get Multiple Devices Data (Map View)
```http
GET /api/v1/devices/data/latest?device_ids=101,102,103
Authorization: Bearer <token>

Response 200 OK
{
    "devices": [
        {
            "device_id": 101,
            "name": "Sensor A",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "readings": {
                "temperature": 23.5,
                "humidity": 65
            },
            "last_update": "2024-03-08T10:16:30Z"
        }
    ]
}
```

---

## Alerts

### Create Alert Rule
```http
POST /api/v1/alerts/rules
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "High Temperature Alert",
    "device_id": 101,                          // optional, null for all devices
    "sensor_type_id": 1,                       // temperature
    "condition": ">",
    "threshold_value": 35,
    "duration_seconds": 300,                    // 5 minutes
    "severity": "critical",
    "enabled": true
}

Response 201 Created
{
    "id": 201,
    "name": "High Temperature Alert",
    "created_at": "2024-03-08T10:20:00Z"
}
```

### List Alert Rules
```http
GET /api/v1/alerts/rules
Authorization: Bearer <token>

Response 200 OK
{
    "rules": [
        {
            "id": 201,
            "name": "High Temperature Alert",
            "device": {
                "id": 101,
                "name": "Greenhouse North Sensor"
            },
            "condition": "temperature > 35 for 5 minutes",
            "severity": "critical",
            "enabled": true
        }
    ]
}
```

### Get Active Alerts
```http
GET /api/v1/alerts/active
Authorization: Bearer <token>

Response 200 OK
{
    "alerts": [
        {
            "id": 301,
            "rule_name": "High Temperature Alert",
            "device_name": "Greenhouse North Sensor",
            "value": 36.2,
            "message": "Temperature exceeded 35°C (current: 36.2°C)",
            "severity": "critical",
            "triggered_at": "2024-03-08T10:25:00Z"
        }
    ]
}
```

### Acknowledge Alert
```http
PATCH /api/v1/alerts/301/acknowledge
Authorization: Bearer <token>

Response 200 OK
{
    "id": 301,
    "status": "acknowledged",
    "acknowledged_at": "2024-03-08T10:30:00Z"
}
```

---

## Control Commands

### Send Manual Command
```http
POST /api/v1/devices/101/commands
Authorization: Bearer <token>
Content-Type: application/json

{
    "command": "turn_on",
    "parameters": {
        "duration": 30,                         // seconds
        "power": 100                            // percentage
    }
}

Response 202 Accepted
{
    "command_id": 401,
    "status": "pending",
    "created_at": "2024-03-08T10:35:00Z"
}
```

### Get Command Status
```http
GET /api/v1/devices/101/commands/401
Authorization: Bearer <token>

Response 200 OK
{
    "command_id": 401,
    "device_id": 101,
    "command": "turn_on",
    "parameters": {"duration": 30, "power": 100},
    "status": "executed",
    "sent_at": "2024-03-08T10:35:01Z",
    "delivered_at": "2024-03-08T10:35:02Z",
    "executed_at": "2024-03-08T10:35:05Z"
}
```

---

## Automation Rules

### Create Automation Rule
```http
POST /api/v1/automation/rules
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "Auto Irrigation",
    "target_device_id": 102,                     // irrigation controller
    "trigger_type": "sensor",
    "trigger_sensor_type_id": 3,                  // soil_moisture
    "trigger_condition": "<",
    "trigger_value": 30,
    "trigger_duration_seconds": 60,
    "action_command": "turn_on",
    "action_parameters": {
        "duration": 300                           // water for 5 minutes
    },
    "enabled": true
}

Response 201 Created
{
    "id": 501,
    "name": "Auto Irrigation",
    "created_at": "2024-03-08T10:40:00Z"
}
```

### List Automation Rules
```http
GET /api/v1/automation/rules
Authorization: Bearer <token>

Response 200 OK
{
    "rules": [
        {
            "id": 501,
            "name": "Auto Irrigation",
            "trigger": "soil_moisture < 30 for 60s",
            "action": "turn_on irrigation for 5 min",
            "enabled": true
        }
    ]
}
```

---

## Analytics

### Generate Report
```http
GET /api/v1/analytics/report?device_id=101&start=2024-03-01&end=2024-03-08&report_type=daily
Authorization: Bearer <token>

Response 200 OK
{
    "device_id": 101,
    "device_name": "Greenhouse North Sensor",
    "period": {
        "start": "2024-03-01",
        "end": "2024-03-08"
    },
    "temperature": {
        "avg": 22.3,
        "min": 18.1,
        "max": 26.8,
        "unit": "°C"
    },
    "humidity": {
        "avg": 62,
        "min": 45,
        "max": 78,
        "unit": "%"
    },
    "daily_data": [
        {
            "date": "2024-03-01",
            "temperature_avg": 21.5,
            "humidity_avg": 65
        }
    ]
}
```

---

## WebSocket API

### Connection
```javascript
ws://localhost:8080/ws?token=<jwt_token>
```

### Server → Client Messages

**Live Sensor Update**
```json
{
    "type": "sensor_data",
    "payload": {
        "device_id": 101,
        "sensor_type": "temperature",
        "value": 23.5,
        "timestamp": "2024-03-08T10:16:30Z"
    }
}
```

**New Alert**
```json
{
    "type": "alert",
    "payload": {
        "alert_id": 301,
        "device_id": 101,
        "message": "High temperature alert",
        "severity": "critical",
        "triggered_at": "2024-03-08T10:25:00Z"
    }
}
```

**Command Status Update**
```json
{
    "type": "command_status",
    "payload": {
        "command_id": 401,
        "device_id": 101,
        "status": "executed",
        "executed_at": "2024-03-08T10:35:05Z"
    }
}
```

### Client → Server Messages

**Subscribe to Device**
```json
{
    "action": "subscribe",
    "device_id": 101
}
```

**Unsubscribe from Device**
```json
{
    "action": "unsubscribe",
    "device_id": 101
}
```

---

## MQTT API (Device Communication)

### Device → Platform

**Authentication**
```
Topic: device/{device_id}/auth
Payload:
{
    "device_id": "esp32_sensor_001",
    "password": "device_secret"
}
```

**Data Publishing**
```
Topic: device/{device_id}/telemetry
Payload:
{
    "timestamp": "2024-03-08T10:16:30Z",
    "readings": [
        {"sensor": "temperature", "value": 23.5},
        {"sensor": "humidity", "value": 65}
    ]
}
```

**Heartbeat**
```
Topic: device/{device_id}/heartbeat
Payload:
{
    "timestamp": "2024-03-08T10:16:30Z",
    "rssi": -67,
    "battery": 85
}
```

**Command Response**
```
Topic: device/{device_id}/response
Payload:
{
    "command_id": 401,
    "status": "executed",
    "timestamp": "2024-03-08T10:35:05Z"
}
```

### Platform → Device

**Send Command**
```
Topic: device/{device_id}/commands
Payload:
{
    "command_id": 401,
    "command": "turn_on",
    "parameters": {"duration": 30, "power": 100},
    "timestamp": "2024-03-08T10:35:00Z"
}
```

**Configuration Update**
```
Topic: device/{device_id}/config
Payload:
{
    "config_id": 1001,
    "config": {
        "reporting_interval": 30
    },
    "timestamp": "2024-03-08T10:40:00Z"
}
```

---

## Status Codes

| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (for async commands) |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict (duplicate device_id) |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

---

## API Versioning
- Current version: v1
- Version in URL path: `/api/v1/`
- Breaking changes → new version (v2)

## Rate Limiting
- Authenticated: 100 requests/minute
- Unauthenticated: 20 requests/minute
- Device MQTT: No limit (but QoS controls)

## Pagination
All list endpoints support:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
