# AgriSenseIoT - Backend Handoff Documentation

## 🚀 Live Environment

| Service | URL |
|---------|-----|
| **API Base URL** | `http://47.94.43.108:8080/api/v1` |
| **WebSocket** | `ws://47.94.43.108:8080/ws` |
| **Health Check** | `http://47.94.43.108:8080/health` |
| **Metrics** | `http://47.94.43.108:8080/metrics` |
| **EMQX Dashboard** | `http://47.94.43.108:18083` (admin/public) |

---

## 🔐 Authentication Flow

### 1. Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "farmer_john",
  "email": "john@example.com",
  "password": "SecurePass123"
}

Response 201 Created
{
  "id": 1,
  "username": "farmer_john",
  "email": "john@example.com",
  "role": "viewer",
  "created_at": "2026-03-11T10:00:00Z"
}
```

### 2. Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123"
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

### 3. Authenticated Requests
Add this header to **ALL** subsequent requests:
```
Authorization: Bearer <your-jwt-token>
```

---

## 📡 Core API Endpoints

### Devices

#### List All Devices

```http
GET /api/v1/devices?page=1&limit=20
Authorization: Bearer <token>

Response 200 OK
{
  "total": 150,
  "page": 1,
  "limit": 20,
  "devices": [
    {
      "id": 101,
      "device_id": "sensor-001",
      "name": "Greenhouse Sensor",
      "type": "sensor",
      "status": "online",
      "last_heartbeat": "2026-03-11T09:30:00Z",
      "location": "Greenhouse A"
    }
  ]
}
```

#### Register New Device

```http
POST /api/v1/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "device_id": "sensor-002",
  "name": "North Field Sensor",
  "type": "sensor",
  "location": "North Field",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "config": {
    "reporting_interval": 60
  }
}

Response 201 Created
{
  "id": 102,
  "device_id": "sensor-002",
  "name": "North Field Sensor",
  "status": "offline",
  "created_at": "2026-03-11T10:05:00Z"
}
```

#### Get Device Details

```http
GET /api/v1/devices/101
Authorization: Bearer <token>

Response 200 OK
{
  "id": 101,
  "device_id": "sensor-001",
  "name": "Greenhouse Sensor",
  "type": "sensor",
  "location": "Greenhouse A",
  "status": "online",
  "last_heartbeat": "2026-03-11T09:30:00Z",
  "config": {
    "reporting_interval": 60
  }
}
```

#### Update Device

```http
PUT /api/v1/devices/101
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Sensor Name",
  "location": "Greenhouse B",
  "config": {
    "reporting_interval": 30
  }
}

Response 200 OK
{
  "id": 101,
  "name": "Updated Sensor Name",
  "location": "Greenhouse B",
  "updated_at": "2026-03-11T10:15:00Z"
}
```

#### Delete Device

```http
DELETE /api/v1/devices/101
Authorization: Bearer <token>

Response 204 No Content
```

---

## 📊 Sensor Data

### Get Latest Readings

```http
GET /api/v1/devices/101/data/latest?sensor_type=temperature
Authorization: Bearer <token>

Response 200 OK
{
  "device_id": "sensor-001",
  "sensor_type": "temperature",
  "value": 23.5,
  "timestamp": "2026-03-11T09:35:00Z"
}
```

### Get Historical Data

```http
GET /api/v1/devices/101/data?sensor_type=temperature&start=2026-03-10T00:00:00Z&end=2026-03-11T00:00:00Z
Authorization: Bearer <token>

Response 200 OK
[
  {
    "timestamp": "2026-03-10T00:00:00Z",
    "value": 22.1
  },
  {
    "timestamp": "2026-03-10T01:00:00Z",
    "value": 21.8
  }
]
```

### Get Aggregated Data

```http
GET /api/v1/devices/101/data/aggregated?sensor_type=temperature&interval=1h&start=2026-03-01T00:00:00Z&end=2026-03-08T00:00:00Z
Authorization: Bearer <token>

Response 200 OK
[
  {
    "timestamp": "2026-03-01T00:00:00Z",
    "avg": 22.3
  }
]
```

### Map View (Multiple Devices)

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
      "last_update": "2026-03-11T09:35:00Z"
    }
  ]
}
```

---

## ⚠️ Alerts

### Create Alert Rule

```http
POST /api/v1/alerts/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "High Temperature Alert",
  "sensor_type_id": 1,
  "condition": ">",
  "threshold_value": 35,
  "duration_seconds": 300,
  "severity": "critical",
  "enabled": true
}

Response 201 Created
{
  "id": 201,
  "name": "High Temperature Alert",
  "created_at": "2026-03-11T10:20:00Z"
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
      "device_name": "Greenhouse Sensor",
      "value": 36.2,
      "message": "Temperature exceeded 35°C",
      "severity": "critical",
      "triggered_at": "2026-03-11T09:25:00Z"
    }
  ]
}
```

### Acknowledge Alert

```http
POST /api/v1/alerts/301/acknowledge
Authorization: Bearer <token>

Response 200 OK
{
  "id": 301,
  "status": "acknowledged",
  "acknowledged_at": "2026-03-11T10:30:00Z"
}
```

### Alert History

```http
GET /api/v1/alerts/history?page=1&limit=20
Authorization: Bearer <token>

Response 200 OK
{
  "alerts": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

---

## 🎮 Control Commands

### Send Command to Device

```http
POST /api/v1/devices/101/commands
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "turn_on",
  "parameters": {
    "duration": 30,
    "power": 100
  }
}

Response 202 Accepted
{
  "command_id": 401,
  "status": "pending",
  "created_at": "2026-03-11T10:35:00Z"
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
  "parameters": {"duration": 30},
  "status": "executed",
  "executed_at": "2026-03-11T10:35:05Z"
}
```

### List Device Commands

```http
GET /api/v1/devices/101/commands?limit=10
Authorization: Bearer <token>

Response 200 OK
{
  "commands": [...]
}
```

---

## 🔌 WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://47.94.43.108:8080/ws?token=' + jwtToken);
```

### Events Received

#### Live Sensor Update

```json
{
  "type": "sensor_data",
  "payload": {
    "device_id": 101,
    "sensor_type": "temperature",
    "value": 23.5,
    "timestamp": "2026-03-11T10:16:30Z"
  }
}
```

#### New Alert

```json
{
  "type": "alert",
  "payload": {
    "alert_id": 301,
    "device_id": 101,
    "message": "High temperature alert",
    "severity": "critical",
    "triggered_at": "2026-03-11T10:25:00Z"
  }
}
```

#### Command Status Update

```json
{
  "type": "command_status",
  "payload": {
    "command_id": 401,
    "device_id": 101,
    "status": "executed",
    "executed_at": "2026-03-11T10:35:05Z"
  }
}
```

### Client Actions

#### Subscribe to Device

```json
{
  "action": "subscribe",
  "device_id": 101
}
```

#### Unsubscribe from Device

```json
{
  "action": "unsubscribe",
  "device_id": 101
}
```

---

## ⚙️ Configuration

### CORS
Already enabled for all origins. Frontend can call from any domain.

### Rate Limits
| Endpoint Type | Limit |
|--------------|-------|
| Authenticated | 100 requests/minute |
| Unauthenticated | 20 requests/minute |
| MQTT | No limit |

### Status Codes
| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async) |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Error |

---

## 📝 Error Response Format
```json
{
  "error": "Human readable error message"
}
```

---

---

## ✅ Quick Start for Frontend

```javascript
// 1. Login
const login = await fetch('http://47.94.43.108:8080/api/v1/auth/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: 'test@example.com', password: 'test123'})
});
const { token } = await login.json();

// 2. Use token for all requests
const devices = await fetch('http://47.94.43.108:8080/api/v1/devices', {
  headers: {'Authorization': `Bearer ${token}`}
});

// 3. Connect to WebSocket for live updates
const ws = new WebSocket(`ws://47.94.43.108:8080/ws?token=${token}`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Live update:', data);
};
```

---

