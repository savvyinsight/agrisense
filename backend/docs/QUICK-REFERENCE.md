# AgriSenseIoT Architecture - Quick Reference Guide

This is a quick lookup guide for understanding the system at a glance.

---

## System Context Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    AGRISENSEIOT SYSTEM                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  📱 Agricultural Sensors    🎬 Command Queue               │
│  (ESP32/Arduino/MQTT)       (Control) ◄──┐                 │
│         │                                 │                 │
│         │ MQTT                       REST API                │
│         ▼                               ▲                    │
│    ┌─────────────┐              ┌───────┴──────┐           │
│    │ EMQX Broker │◄─────────────┤ API Server   │           │
│    │ (10k conns) │ WebSocket    │ (Port 8080)  │           │
│    └─────────────┘──────────────►└──────────────┘           │
│         │                             │                      │
│         │ MQTT                   HTTP │                      │
│         ▼                             ▼                      │
│    ┌─────────────────┐      ┌──────────────────┐           │
│    │ Message Handler │      │  Web Dashboard   │           │
│    │ + Rule Engine   │      │  (Vue.js)        │           │
│    └─────────────────┘      └──────────────────┘           │
│         │                                                     │
│         ├─► Store ───┬──────────────┐                       │
│         └─► Cache    │              │                       │
│             Evaluate │              ▼                       │
│             Alerts   │         ┌──────────────┐            │
│                      │         │   Databases  │            │
│                      │         ├──────────────┤            │
│                      ├────────►│ PostgreSQL   │            │
│                      │         ├──────────────┤            │
│                      ├────────►│ InfluxDB     │            │
│                      │         ├──────────────┤            │
│                      └────────►│ Redis        │            │
│                                └──────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## Service Interaction Map

```
                          ┌─────────────────┐
                          │  EMQX Broker    │
                          │  (MQTT Hub)     │
                          └────────┬────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
    MQTT │                    MQTT │                    MQTT │
         │                         │                         │
         ▼                         ▼                         ▼
    ┌────────────┐         ┌───────────────┐         ┌──────────────┐
    │ MQTT       │         │ API Server    │         │ Dash-         │
    │ Handler    │         │ REST/WS       │         │ board         │
    │ (Backend)  │         │ (Port 8080)   │         │ (Frontend)    │
    └─────┬──────┘         └───┬───────┬───┘         └──────────────┘
          │                    │       │
          │  Parse &           │       │
          │  Validate           │       │ Query via API
          │                    │       │
    ┌─────┼────────┬──────┬───┼───────┼──────────────┐
    │     │        │      │   │       │              │
    ▼     ▼        ▼      ▼   ▼       ▼              ▼
 ┌──────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌─────────────┐
 │PG    │ │IDB   │ │Re  │ │Auth  │ │ Rule Engine │
 │sto  │ │(time │ │dis │ │ Svc  │ │ (Alerts)    │
 │rage │ │series)│ │ │  │ │       │ │             │
 └──────┘ └──────┘ └─┬──┘ └──────┘ └─────────────┘
                     │
                     ▼
           ┌──────────────────┐
           │ WebSocket Clients│
           │ (Real-time udate│
           └──────────────────┘
```

---

## Data Storage Quick Reference

### What goes where?

```
POSTGRESQL (Relational - ACID)
├─ Users & authentication
├─ Devices (metadata, config)
├─ Sensor types (definitions)
├─ Alert rules (conditions)
├─ Alert history (triggered, acknowledged)
├─ Control commands (status tracking)
├─ Automation rules
└─> Use when: Consistency, relationships, updates matter

INFLUXDB (Time-Series)
├─ Sensor readings (temperature, humidity, etc.)
├─ Aggregated metrics (1hr, 1day averages)
├─ Downsampled data (for long-term storage)
└─> Use when: High-volume writes, time-based queries

REDIS (Cache & Streams)
├─ Latest sensor values (device:X:latest)
├─ Device online/offline status
├─ Alert count cache
├─ Command queue (streams)
├─ Alert event stream
└─> Use when: Speed, pub/sub, temporary data
```

---

## Key Data Models

### Device Entity
```json
{
  "id": 1,
  "device_id": "sensor-001",
  "name": "Greenhouse A",
  "type": "sensor",
  "geo_location": { "lat": 40.7128, "lng": -74.0060 },
  "status": "online",
  "last_heartbeat": "2026-04-17T10:30:45Z",
  "firmware_version": "1.2.3",
  "config": { "sampling_interval": 60 }
}
```

### Sensor Reading (InfluxDB)
```
Measurement: sensor_data
Tags:
  device_id=sensor-001
  sensor_type=temperature
  location=greenhouse_a
Fields:
  value=28.5
  unit=°C
Time: 2026-04-17T10:30:45.123456789Z
```

### Alert Rule
```json
{
  "id": 42,
  "name": "High Temperature Alert",
  "device_id": 1,
  "sensor_type_id": 1,
  "condition": ">",
  "threshold_value": 35.0,
  "duration_seconds": 300,
  "severity": "critical",
  "enabled": true
}
```

### Control Command
```json
{
  "id": 100,
  "device_id": 1,
  "command": "start_pump",
  "parameters": { "duration": 30 },
  "status": "executed",
  "created_at": "2026-04-17T10:28:00Z",
  "executed_at": "2026-04-17T10:28:05Z"
}
```

---

## API Endpoints Summary

### Authentication
```
POST   /api/v1/auth/register    - Create user account
POST   /api/v1/auth/login       - Get JWT token
POST   /api/v1/auth/refresh     - Refresh JWT
GET    /api/v1/auth/me          - Current user info
```

### Devices
```
GET    /api/v1/devices          - List all devices
POST   /api/v1/devices          - Register device
GET    /api/v1/devices/:id      - Device details
PUT    /api/v1/devices/:id      - Update device
DELETE /api/v1/devices/:id      - Remove device
GET    /api/v1/devices/:id/status - Device online/offline
```

### Data & Analytics
```
GET    /api/v1/devices/:id/data/latest       - Latest reading
GET    /api/v1/devices/:id/data/history      - Time range query
GET    /api/v1/devices/:id/analytics/trends  - Trend analysis
```

### Alerts
```
GET    /api/v1/alerts/rules           - List rules
POST   /api/v1/alerts/rules           - Create rule
PUT    /api/v1/alerts/rules/:id       - Update rule
DELETE /api/v1/alerts/rules/:id       - Delete rule
GET    /api/v1/alerts/active          - Active alerts
POST   /api/v1/alerts/:id/acknowledge - Mark as read
```

### Control
```
POST   /api/v1/devices/:id/commands        - Send command
GET    /api/v1/devices/:id/commands        - Command history
GET    /api/v1/devices/:id/commands/:cmd_id - Command status
```

### WebSocket
```
WS     /ws/live                    - Real-time updates
  Events received:
  - {"type": "telemetry", "device_id": X, "value": Y}
  - {"type": "alert", "alert_id": X, "severity": "critical"}
  - {"type": "device_status", "device_id": X, "status": "online"}
  - {"type": "command_executed", "command_id": X}
```

---

## MQTT Topics

### Device → Server (Publish)
```
device/{device_id}/telemetry         - Sensor readings
device/{device_id}/heartbeat         - Status signal
device/{device_id}/response          - Command acknowledgment
device/{device_id}/error             - Error messages
```

### Server → Device (Publish)
```
control/{device_id}/command          - Remote command
control/{device_id}/config           - Configuration update
control/{device_id}/update           - Firmware update
```

### Example Topic Subscription
```go
// MQTT Handler subscribes to:
EMQX.Subscribe("device/+/telemetry")  // All device readings
EMQX.Subscribe("device/+/heartbeat")  // All device status
EMQX.Subscribe("device/+/response")   // All device responses
```

---

## Concurrency Model Summary

### Go Routines Used

```
Main Process
├─ API Handler Pool (Gin)
│  └─ 1 goroutine per incoming request
│     (Go runtime manages up to 1000s)
│
├─ MQTT Handler Service
│  ├─ 1: Subscribe loop (blocking)
│  ├─ 4-8: Message processors (CPU-bound)
│  ├─ 2: Database writers (I/O-bound)
│  └─ 2: Rule evaluators
│
├─ WebSocket Manager
│  ├─ 1: Hub (connection dispatcher)
│  └─ N: Client handlers (1 per connection)
│
└─ Background Workers
   ├─ Cache refresh
   ├─ Cleanup jobs
   └─ Metrics collection

Total: Adaptive (hundreds to thousands based on load)
```

**Why Go?**
- Lightweight goroutines (can run 100k+)
- No thread overhead
- Built-in channels for communication
- Async I/O model (perfect for servers)

---

## Performance Quick Facts

### Bottleneck Analysis
```
Operation              Bottleneck        Solution
─────────────────────────────────────────────────────
1000 devices → EMQX   Network I/O       Add LB
1000 API requests     Server CPU        Horizontal scale
Telemetry storage     Writer threads     Batch writes
Time-series queries   Disk I/O          Add retentions
```

### Caching Strategy
```
Hot Data (< 1 hour old)
  └─ Redis cache
     Hit rate: 80-95%
     
Warm Data (1-7 days old)
  └─ PostgreSQL + Query cache
     Hit rate: 50-70%
     
Cold Data (> 7 days old)
  └─ InfluxDB with downsampling
     Or archive to S3
```

### Scaling Path
```
Phase 1 (Now): Single instance
├─ All services: Docker containers
├─ Load: 100-500 devices
└─ Latency: < 500ms

Phase 2 (3 months): Multi-instance
├─ API servers: 2-3 replicas (LB)
├─ Load: 1000-5000 devices
└─ Latency: < 250ms

Phase 3 (12 months): Production cluster
├─ Kubernetes deployment
├─ EMQX cluster
├─ PostgreSQL replicas
├─ Load: 10k+ devices
└─ Latency: < 100ms
```

---

## Environment Variables

### Required for Running

```bash
# Server
PORT=8080
ENV=development
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=agrisense
DB_SSLMODE=disable

# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=my-token
INFLUX_ORG=my-org
INFLUX_BUCKET=sensor_data

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# MQTT
MQTT_BROKER=emqx:1883
MQTT_USERNAME=
MQTT_PASSWORD=
```

---

## Common Development Tasks

### Start Everything
```bash
# Terminal 1: Dependencies
make docker-up

# Terminal 2: API Server
go run cmd/server/main.go

# Terminal 3: MQTT Handler
go run cmd/mqtt-handler/main.go

# Terminal 4: Frontend
cd web && npm run dev

# Terminal 5: Device Simulator (optional)
go run scripts/generate-device-simulator/main.go
```

### Test a Device Connection
```bash
# Terminal 1: Subscribe to all device topics
mosquitto_sub -h localhost -p 1883 -t 'device/+/#'

# Terminal 2: Publish test message
mosquitto_pub -h localhost -p 1883 \
  -t device/sensor-001/telemetry \
  -m '{"temperature":28.5,"humidity":65.2}'

# Expected: Message appears in Terminal 1
```

### Query Time-Series Data
```bash
# Via API
curl http://localhost:8080/api/v1/devices/1/data/history \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "?start=2026-04-17T00:00:00Z&end=2026-04-17T23:59:59Z"

# Via InfluxDB CLI
influx query 'from(bucket:"sensor_data") |> range(start:-24h)'
```

### Create Alert Rule
```bash
curl -X POST http://localhost:8080/api/v1/alerts/rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Temp",
    "device_id": 1,
    "sensor_type_id": 1,
    "condition": ">",
    "threshold_value": 35.0,
    "severity": "critical"
  }'
```

---

## Debugging Checklist

### Device Not Connecting
- [ ] Check EMQX is running: `docker ps | grep emqx`
- [ ] Verify device credentials in EMQX ACL
- [ ] Check MQTT broker logs: `docker logs agrisense-emqx`
- [ ] Verify network: `ping emqx` from device

### Data Not Appearing
- [ ] Check MQTT handler is running
- [ ] Verify topic subscription: `docker logs agrisense-handler`
- [ ] Check InfluxDB: `influx bucket list`
- [ ] Verify Redis connection: `redis-cli ping`

### API Returning Errors
- [ ] Check API logs: `docker logs agrisense-api`
- [ ] Verify JWT token: `Bearer TOKEN` in header
- [ ] Test endpoint directly: `curl http://localhost:8080/health`
- [ ] Check PostgreSQL: `docker logs agrisense-postgres`

### High Latency
- [ ] Check Redis cache hit rate
- [ ] Verify InfluxDB query performance
- [ ] Look for goroutine leaks
- [ ] Monitor container resource usage

---

## Architecture Evolution

This architecture supports:

✅ **Current**
- 100-1000 devices
- Real-time monitoring
- Alert generation
- Remote control

🚀 **Coming Soon** (3-6 months)
- Horizontal API scaling
- EMQX clustering
- Advanced analytics
- Machine learning alerts

🎯 **Future** (12+ months)
- Kubernetes deployment
- Multi-region setup
- Edge computing nodes
- Predictive maintenance

---

## Links to Full Documentation

- [architecture-detailed.md](./architecture-detailed.md) - Complete details
- [architecture.md](./architecture.md) - Original overview
- [database.md](./database.md) - Schema design
- [api.md](./api.md) - Endpoint documentation
- [implementation-plan.md](./implementation-plan.md) - Development roadmap

---

**Created**: April 2026  
**For**: AgriSenseIoT Development Team  
**Status**: Living Document (Updated as system evolves)
