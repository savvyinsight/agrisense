# AgriSenseIoT - Detailed System Architecture

**Last Updated**: April 2026  
**Purpose**: Comprehensive guide to the system architecture, data flows, and design patterns

---

## Table of Contents

1. [Overview](#overview)
2. [Layered Architecture](#layered-architecture)
3. [Component Details](#component-details)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Architectural Patterns](#architectural-patterns)
6. [High-Concurrency Design](#high-concurrency-design)
7. [Deployment Architecture](#deployment-architecture)
8. [Performance Characteristics](#performance-characteristics)

---

## Overview

**AgriSenseIoT** is a production-oriented IoT monitoring platform designed for:
- ✅ Real-time environmental data collection from agricultural sensors
- ✅ High-concurrency device data handling (10,000+ simultaneous connections)
- ✅ Low-latency data processing and alerting (< 500ms)
- ✅ Remote device control via MQTT
- ✅ Historical data analysis and trend detection

### Core Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Backend** | Go (Gin) | High concurrency, fast performance, simple deployment |
| **MQTT Broker** | EMQX | Production-ready, 10k+ concurrent connections, clustering support |
| **Relational DB** | PostgreSQL | ACID compliance, PostGIS for geolocation, JSON support |
| **Time-series DB** | InfluxDB | Optimized for sensor data, high write throughput, retention policies |
| **Cache/Streams** | Redis | Sub-millisecond latency, pub/sub messaging, data aggregation |
| **Frontend** | Vue.js/React | Modern, component-based, WebSocket support |
| **Container** | Docker Compose | Consistent deployment, easy local development |

---

## Layered Architecture

### Visual Representation

```
┌──────────────────────────────────────────────────────────┐
│ Frontend Layer (Vue.js/React)                            │
│ ├─ Live Dashboards                                       │
│ ├─ Historical Charts                                     │
│ ├─ Device Control Panels                                 │
│ └─ Alert Notifications                                   │
└────────────┬─────────────────────────────────────────────┘
             │ REST API / WebSocket
┌────────────▼─────────────────────────────────────────────┐
│ API Layer (Port 8080)                                    │
│ ├─ REST Endpoints (Authentication, CRUD operations)      │
│ ├─ WebSocket Handler (Real-time updates)                 │
│ ├─ Middleware (Auth, Logging, Metrics)                   │
│ └─ Health Checks & Monitoring                            │
└────────────┬──────────────────────────────┬──────────────┘
             │ MQTT                         │ HTTP
┌────────────▼──────────────┐   ┌───────────▼──────────────┐
│ MQTT Broker (EMQX)        │   │ Device Handler Service   │
│ ├─ Device Auth/Authn      │   │ ├─ Message Processing    │
│ ├─ Topic Routing          │   │ ├─ Validation            │
│ ├─ QoS Management         │   │ ├─ Rule Evaluation       │
│ └─ 10k+ Connections       │   │ ├─ Data Aggregation      │
│    (Port 1883)            │   │ └─ Alert Generation      │
└───────────┬────────────────┘   └───────────┬──────────────┘
            │                                │
            └────────────┬───────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼────────────────┐  ┌▼──────────────────┐ ┌▼──────────────┐
│ PostgreSQL         │  │ InfluxDB          │ │ Redis         │
│ (Port 5432)        │  │ (Port 8086)       │ │ (Port 6379)   │
│                    │  │                   │ │               │
│ ├─ Users           │  │ ├─ Sensor Data    │ │ ├─ Cache      │
│ ├─ Devices         │  │ ├─ Time Series    │ │ ├─ Streams    │
│ ├─ Rules           │  │ ├─ Aggregations   │ │ ├─ Pub/Sub    │
│ ├─ Alerts History  │  │ └─ Retention      │ │ └─ Alerting   │
│ └─ Commands        │  │                   │ │               │
└────────────────────┘  └───────────────────┘ └───────────────┘
```

---

## Component Details

### 🔹 Layer 1: Device Layer

| Component | Description |
|-----------|-------------|
| **Physical Sensors** | ESP32/Arduino with built-in MQTT support |
| **Sensor Types** | Temperature (°C), Humidity (%), Soil Moisture (%), Light (lux) |
| **Microcontroller** | Collects readings from analog/digital sensors |
| **MQTT Client** | Publishes telemetry to EMQX broker |
| **Heartbeat** | Periodic status messages for connectivity monitoring |
| **Authentication** | Device credentials validated by EMQX |

**Sample Device Payload:**
```json
{
  "device_id": "sensor-001",
  "timestamp": "2026-04-17T10:30:45Z",
  "sensors": {
    "temperature": 28.5,
    "humidity": 65.2,
    "soil_moisture": 42.1,
    "light_intensity": 8500
  }
}
```

**Topics:**
- `device/{device_id}/telemetry` - Sensor readings
- `device/{device_id}/heartbeat` - Status updates
- `device/{device_id}/response` - Command acknowledgments
- `control/{device_id}/command` - Incoming commands from server

---

### 🔹 Layer 2: Transport Layer (EMQX Broker)

**EMQX** is the central MQTT hub handling all device communication.

#### Key Responsibilities:

1. **Device Authentication**
   - Validates device credentials on connection
   - Prevents unauthorized access
   - Supports password and certificate-based auth

2. **Message Routing**
   - Routes telemetry to subscribed consumers (MQTT Handler, API)
   - Ensures delivery based on QoS levels
   - Handles topic matching with wildcards

3. **QoS Level Support**
   - **QoS 0** (At most once): Fire-and-forget (heartbeats, non-critical data)
   - **QoS 1** (At least once): Guaranteed delivery (telemetry data)
   - **QoS 2** (Exactly once): No duplicates (critical commands)

4. **Connection Management**
   - Manages 10,000+ concurrent device connections
   - Handles device disconnect/reconnect scenarios
   - Maintains client state and subscriptions

5. **Persistence**
   - Queues messages during broker downtime
   - Delivers queued messages on device reconnection
   - Configurable retention policies

**Ports:**
- `1883` - MQTT over TCP
- `8083` - MQTT over WebSocket
- `8084` - MQTT over WebSocket with TLS
- `18083` - EMQX Management Dashboard

---

### 🔹 Layer 3: Backend Services

#### **Service 1: API Server** (`cmd/server/main.go`)

**Purpose**: Primary HTTP API for frontend and external integrations

**Responsibilities:**
- User authentication & authorization (JWT)
- RESTful endpoints for CRUD operations
- WebSocket connections for real-time updates
- Request validation and error handling
- Metrics collection (Prometheus)

**Key Endpoints:**
```
POST   /api/v1/auth/register         - User registration
POST   /api/v1/auth/login            - User login (get JWT)
GET    /api/v1/devices               - List all devices
POST   /api/v1/devices               - Register new device
GET    /api/v1/devices/:id/data      - Get latest sensor data
GET    /api/v1/devices/:id/history   - Historical data
POST   /api/v1/alerts/rules          - Create alert rule
GET    /api/v1/alerts/active         - Active alerts
POST   /api/v1/devices/:id/commands  - Send control command
WS     /ws/live                      - WebSocket for real-time updates
```

**Middleware Stack:**
- CORS handling
- JWT authentication
- Request logging (structured)
- Rate limiting
- Panic recovery

---

#### **Service 2: MQTT Handler** (`cmd/mqtt-handler/main.go`)

**Purpose**: Background service processing all MQTT messages

**Responsibilities:**
1. Subscribe to EMQX telemetry topics
2. Parse and validate incoming sensor data
3. Store time-series data to InfluxDB
4. Cache latest readings in Redis
5. Trigger rule engine for alert evaluation
6. Handle device status updates (online/offline)
7. Process command acknowledgments

**Message Processing Flow:**
```
MQTT Message → Handler
    ├─ Parse JSON payload
    ├─ Validate against schema
    ├─ Store to InfluxDB (async)
    ├─ Update Redis cache
    ├─ Evaluate rules
    ├─ Trigger alerts if needed
    └─ Publish WebSocket updates
```

**Configuration:**
- EMQX connection pool
- Batch writes to InfluxDB (for performance)
- Circuit breaker patterns for resilience

---

#### **Service 3: Rule Engine** (`internal/ruleengine/`)

**Purpose**: Evaluates alert conditions on incoming sensor data

**Supported Rule Types:**
1. **Threshold Rules**
   ```
   IF temperature > 35°C THEN severity=critical
   ```

2. **Range Rules**
   ```
   IF humidity NOT BETWEEN 40% AND 80% THEN severity=warning
   ```

3. **Composite Rules**
   ```
   IF (temp > 35) AND (humidity < 30) THEN severity=critical
   ```

4. **Time-based Rules**
   ```
   IF device offline for 5 minutes THEN severity=warning
   ```

**Evaluation Process:**
```
Rule Definition (from PostgreSQL)
    ↓
Latest Sensor Value (from Redis)
    ↓
Evaluate Condition
    ├─ Passes? → No alert
    └─ Fails? → Generate alert event
         ↓
    Alert Service
         ├─ Store to PostgreSQL
         ├─ Publish to Redis stream
         └─ Notify WebSocket clients
```

---

### 🔹 Layer 4: Business Logic Services

Located in `internal/service/`:

#### **Auth Service** (`auth/service.go`)
- User registration with password hashing
- JWT token generation & validation
- Token refresh mechanism
- Role-based access control (RBAC)

#### **Device Service** (`device/service.go`)
- Device registration (provisioning)
- Status tracking (online/offline)
- Heartbeat monitoring
- Firmware version management
- Device metadata updates

#### **Data Service** (`data/service.go`)
- Sensor data validation
- Unit conversion
- Statistical aggregation (min, max, avg)
- Outlier detection
- Data retention policies

#### **Alert Service** (`alert/service.go`)
- Alert rule CRUD operations
- Alert generation and storage
- Alert acknowledgment/resolution
- Notification dispatch
- Alert escalation logic

#### **Control Service** (`control/service.go`)
- Command queue management
- Device command dispatch
- Execution status tracking
- ACK/NACK handling
- Command history

#### **Analytics Service** (`analytics/service.go`)
- Trend analysis
- Pattern recognition
- Performance reports
- Predictive analytics (future)

#### **Automation Service** (`automation/service.go`)
- Scheduled task execution
- Auto-remediation rules
- Workflow orchestration

---

### 🔹 Layer 5: Data Storage

#### **PostgreSQL** (Relational Data)

**Schema Overview:**

```sql
users
├── id (PK)
├── username, email
├── password_hash
├── role (admin/viewer)
└── timestamps

devices
├── id (PK)
├── device_id (UNIQUE)
├── name, type, location
├── geo_location (PostGIS POINT)
├── status (online/offline)
├── last_heartbeat
├── config (JSONB)
└── user_id (FK)

sensor_types
├── id (PK)
├── name (temperature, humidity, etc.)
├── unit (°C, %, lux)
├── min_value, max_value
└── metadata (JSONB)

alert_rules
├── id (PK)
├── name, device_id, sensor_type_id
├── condition (>, <, =, >=, <=, between)
├── threshold_value, threshold_max
├── duration_seconds (for time-based)
├── severity (info/warning/critical)
├── enabled (boolean)
└── timestamps

alerts
├── id (PK)
├── rule_id, device_id
├── sensor_value, message
├── severity, status
├── triggered_at, acknowledged_at, resolved_at
└── metadata (JSONB)

control_commands
├── id (PK)
├── device_id, command
├── parameters (JSONB)
├── status (pending/sent/delivered/executed/failed)
├── timestamps
└── user_id (who triggered)
```

**Why PostgreSQL?**
- ACID transactions ensure data consistency
- PostGIS extension for geospatial queries
- JSONB for flexible device configs
- Complex JOIN queries for analytics
- Full-text search capabilities

**Indexes:**
- `idx_devices_status` - Quick online/offline checks
- `idx_alerts_triggered_at` - Fast alert history queries
- `idx_devices_geo` - Geographic location queries
- `idx_alert_rules_enabled` - Active rule filtering

---

#### **InfluxDB** (Time-Series Data)

**Measurement: `sensor_data`**

```
sensor_data
├─ tags:
│  ├── device_id
│  ├── sensor_type (temperature, humidity, etc.)
│  ├── location
│  └── user_id
├─ fields:
│  ├── value (float)
│  ├── unit (string)
│  └── accuracy (float)
└─ timestamp (ns precision)
```

**Query Example:**
```sql
SELECT mean(value) 
FROM sensor_data 
WHERE device_id='sensor-001' AND sensor_type='temperature' 
AND time > now() - 1h
GROUP BY time(5m)
```

**Why InfluxDB?**
- Optimized for write-heavy workloads (10,000+ msgs/sec)
- Automatic data compression (80-90% reduction)
- Time-based retention policies
- Built-in downsampling for cost reduction
- Fast range queries for charts

**Retention Policies:**
- Raw data: 7 days
- 1-minute aggregates: 30 days
- 1-hour aggregates: 1 year

---

#### **Redis** (Cache & Streams)

**Data Structures:**

1. **Cache (for latest sensor readings)**
   ```
   KEY: device:{device_id}:latest:{sensor_type}
   VALUE: {value, unit, timestamp}
   TTL: 1 hour (sliding window)
   ```

2. **Device Status**
   ```
   KEY: device:{device_id}:status
   VALUE: "online" | "offline"
   ```

3. **Streams (for pub/sub messaging)**
   ```
   STREAM: command:queue
   ENTRIES: {command_id, device_id, parameters}
   RETENTION: 24 hours
   
   STREAM: alert:stream
   ENTRIES: {alert_id, device_id, severity, message}
   RETENTION: 7 days
   ```

4. **Active Alerts Count**
   ```
   KEY: alerts:active:count
   VALUE: number
   TTL: 5 minutes
   ```

**Why Redis?**
- Sub-millisecond latency for cache hits
- Atomic operations for counter increments
- Streams provide reliable message delivery
- Pub/Sub for instant WebSocket broadcasts
- In-memory performance for hot data

---

## Data Flow Architecture

### Flow 1: Device Data Ingestion

```
┌────────────────────────────────────────────────────────┐
│ TELEMETRY INGESTION FLOW                               │
└────────────────────────────────────────────────────────┘

1. Device Level
   └─> Sensor reading (28.5°C)
       └─> JSON payload
           └─> MQTT publish

2. Transport (EMQX)
   └─> Broker receives message
       └─> Route to subscribers:
           ├─> MQTT Handler
           └─> Dashboard (WebSocket bridge)

3. MQTT Handler Processing
   └─> Listen on device/+/telemetry
       ├─> Parse JSON
       ├─> Validate schema
       └─> Proceed to storage

4. Storage Phase (Parallel)
   ├─> InfluxDB Storage
   │   └─> INSERT INTO sensor_data
   │       VALUE: {device_id, temperature, 28.5, timestamp}
   │       (Async batch write)
   │
   ├─> Redis Cache
   │   └─> SET device:sensor-001:latest:temp "28.5"
   │       EXPIRE 3600 (1 hour)
   │
   └─> PostgreSQL (Optional - critical readings)
       └─> UPDATE devices SET last_reading=28.5

5. Rule Evaluation
   └─> Fetch alert rules for this device
       └─> Get latest value from Redis
           └─> Evaluate each rule
               ├─> Rule: temp > 35°C?
               │   └─> NO → No alert
               │
               └─> Rule: temp < 10°C?
                   └─> NO → No alert

6. WebSocket Update (for connected dashboards)
   └─> Publish to all subscribed clients:
       ├─> Latest reading
       ├─> Device status
       └─> Active alerts count

Latency: ~100ms end-to-end
```

---

### Flow 2: Alert Triggering

```
┌────────────────────────────────────────────────────────┐
│ ALERT GENERATION FLOW                                  │
└────────────────────────────────────────────────────────┘

1. Rule Evaluation (from above)
   └─> Condition TRIGGERS (temp > 35°C with temp=36.2°C)

2. Alert Service
   ├─> Generate alert event
   │   ├─ rule_id: 42
   │   ├─ device_id: sensor-001
   │   ├─ sensor_value: 36.2
   │   ├─ severity: critical
   │   └─ message: "Temperature exceeds 35°C threshold"
   │
   ├─> Store to PostgreSQL
   │   └─> INSERT INTO alerts (...)
   │
   ├─> Update alert count in Redis
   │   └─> INCR alerts:active:count
   │
   ├─> Publish to alert stream
   │   └─> XADD alert:stream {alert data}
   │
   └─> Notify WebSocket clients
       └─> Broadcast: {type: "alert", alert_id: 1234, ...}

3. Notification Dispatch (Future integration)
   ├─> Email to user
   ├─> SMS alert
   └─> Push notification

4. Dashboard Update
   └─> Real-time refresh on all connected clients
       ├─> New alert appears
       ├─> Count increments
       └─> Alert sound/color change

Latency: ~500ms (including notification delivery)
```

---

### Flow 3: Remote Device Control

```
┌────────────────────────────────────────────────────────┐
│ REMOTE CONTROL FLOW                                    │
└────────────────────────────────────────────────────────┘

1. User Action (Dashboard)
   └─> Click "Turn ON irrigation system"
       └─> HTTP POST /api/v1/devices/sensor-001/commands
           {
             "command": "start_pump",
             "parameters": {"duration": 30}
           }

2. API Server (Authorization)
   ├─> Verify JWT token
   ├─> Check user permissions
   └─> Call Control Service

3. Control Service
   ├─> Generate command ID (UUID)
   ├─> Store to PostgreSQL
   │   └─> INSERT INTO control_commands
   │       status='pending'
   │
   ├─> Publish to Redis stream
   │   └─> XADD command:queue {cmd_id, device_id, cmd}
   │
   └─> Publish to MQTT
       └─> PUBLISH control/sensor-001/command
           {
             "command_id": "uuid",
             "command": "start_pump",
             "parameters": {"duration": 30}
           }

4. Return Response (Async)
   └─> API returns: {command_id, status: "pending"}

5. Device Reception (MQTT)
   └─> Device subscribes to control/sensor-001/command
       ├─> Receive command
       ├─> Execute action (start pump)
       ├─> Wait 30 seconds
       ├─> Stop pump
       └─> Publish acknowledgment

6. ACK Processing
   └─> Handler receives device response
       ├─> Parse ACK message
       ├─> Update PostgreSQL
       │   └─> status='executed'
       ├─> Update Redis
       │   └─> Update command status
       └─> Notify dashboard (WebSocket)

7. Dashboard Update
   └─> Show: "Command executed successfully"
       └─> Display execution timestamp

Total Latency: ~1-2 seconds (command → execution → dashboard)
```

---

## Architectural Patterns

### 1. **Publish-Subscribe (Pub/Sub) Pattern**

Used throughout the system for loose coupling:

```
Message Source (EMQX) 
    ↓
Topic-based Subscribers
├─ MQTT Handler (processes telemetry)
├─ API Server (broadcasts to WebSocket)
├─ Rule Engine (evaluates alerts)
└─ Cache Service (updates Redis)
```

**Benefits:**
- ✅ Decoupled components
- ✅ Scalable event distribution
- ✅ Async processing
- ✅ Easy to add new subscribers

---

### 2. **Repository Pattern**

Abstract database access:

```
Service Layer
    ↓
Repository Interface
    ├─ PostgreSQL Implementation
    ├─ InfluxDB Implementation
    └─ Redis Implementation

Benefits:
✅ Easy to swap implementations
✅ Testable with mock repos
✅ Consistent interface
```

**Example:**
```go
interface DeviceRepository {
    GetByID(id string) (*Device, error)
    Save(device *Device) error
    UpdateStatus(id string, status string) error
}

// Multiple implementations
PostgresDeviceRepo
InfluxDeviceRepo
RedisDeviceRepo (cache layer)
```

---

### 3. **Command Query Responsibility Segregation (CQRS)**

Separate read and write paths:

```
WRITE PATH (Commands)
├─ Device sends sensor data
├─ MQTT Handler validates
├─ Store to InfluxDB (append-only)
├─ Update Redis cache
└─> Optimized for high throughput

READ PATH (Queries)
├─ Dashboard requests data
├─ Check Redis first (hot cache)
├─ Cache hit? Return immediately
└─> Cache miss? Query InfluxDB
     └─> Cache result for next request
```

**Performance Benefit:**
- Writes: Optimized for throughput (10k+ req/sec)
- Reads: Optimized for latency (< 5ms with cache)

---

### 4. **Middleware Chain Pattern**

HTTP request processing pipeline:

```
HTTP Request
    ↓
CORS Middleware (allow cross-origin)
    ↓
Authentication Middleware (validate JWT)
    ↓
Authorization Middleware (check permissions)
    ↓
Logging Middleware (structured logs)
    ↓
Rate Limiting Middleware (prevent abuse)
    ↓
Handler (business logic)
    ↓
Response
```

---

### 5. **Circuit Breaker Pattern**

Resilience for external service calls:

```
Service Call Attempt
    ↓
Is circuit OPEN? → YES → Return cached/error
    ↓ NO
Attempt call
    ├─ Success? → CLOSED state
    └─ Failure? → Inc. failure count
         └─ Threshold reached? → OPEN state
              └─ Wait for timeout
              └─ Try HALF_OPEN
              └─> Increment success → CLOSED
```

**Applied to:**
- InfluxDB connections
- PostgreSQL queries
- MQTT broker calls

---

### 6. **Batch Processing Pattern**

For performance optimization:

```
Individual Writes
MQTT Handler
    ├─ Collect messages (batching window)
    ├─ Accumulate in memory
    └─ When batch reaches 1000 OR 5s timeout
        └─ Flush to InfluxDB
            └─ Single batch write (faster than 1000 individual writes)
```

**Benefits:**
- ✅ Reduces database round-trips
- ✅ Better throughput
- ✅ Lower latency variance

---

## High-Concurrency Design

### Write Path Optimization

```
Scenario: 10,000 devices sending telemetry every 10 seconds
Total: ~1,000 messages/second

┌─────────────────────────────┐
│ EMQX Broker                 │
│ (handles all pub/sub)       │
├─────────────────────────────┤
│ Partition 1: Topic group 1  │
│ Partition 2: Topic group 2  │
│ Partition 3: Topic group 3  │
│ Partition 4: Topic group 4  │
└─────────────────────────────┘
            ↓
┌─────────────────────────────┐
│ MQTT Handler (go-routines)  │
│ Pool of workers processing  │
├─────────────────────────────┤
│ Worker 1: device 000-099    │
│ Worker 2: device 100-199    │
│ Worker 3: device 200-299    │
│ Worker 4: device 300-399    │
└─────────────────────────────┘
            ↓
┌─────────────────────────────┐
│ InfluxDB Connection Pool    │
│ Batch writes (1000 points)  │
├─────────────────────────────┤
│ Batch 1: 1000 points        │
│ Batch 2: 1000 points        │
│ Batch 3: 1000 points        │
└─────────────────────────────┘
            ↓
Query execution (much faster than individual writes)
```

### Read Path Optimization

```
Dashboard Request: "Get latest temperature"

REQUEST
    ↓
API Server
    ├─ Check Redis cache
    │   "device:sensor-001:latest:temp"
    │   ├─ HIT? → Return immediately (< 5ms)
    │   └─ MISS? → Continue
    │
    ├─ Query InfluxDB
    │   SELECT LAST(value) FROM sensor_data
    │   WHERE device_id='sensor-001'
    │   (50-100ms with index)
    │
    ├─ Update Redis cache
    │   SET device:sensor-001:latest:temp "28.5"
    │   EXPIRE 3600
    │
    └─> Return response

Cache effectiveness: 90%+ hit rate for recent queries
Average latency: 5ms (cache) vs 50ms (database)
```

### Concurrency Model

```
Go Goroutine Pattern
├─ Main API server: 1 goroutine
│   ├─ Accepts HTTP requests
│   ├─ Spawns handler goroutine per request
│   └─ Returns response when complete
│
├─ MQTT Handler: Multiple workers
│   ├─ Main loop: 1 goroutine (subscribes to topics)
│   ├─ Message processor: 4-8 goroutines (CPU count)
│   ├─ Database writers: 2 goroutines (batch to DB)
│   └─ Rule evaluator: 2 goroutines
│
├─ WebSocket Manager: 1 goroutine
│   ├─ Maintains connection pool
│   ├─ Broadcasts to all subscribers
│   └─ ~100 concurrent connections per instance
│
└─ Service workers: on-demand
    ├─ Database queries
    ├─ Cache operations
    └─ External API calls
```

**Concurrency Benefits:**
- Go handles 100,000+ goroutines efficiently
- Zero overhead per goroutine (vs threads)
- Async I/O via channels and select statements
- Graceful degradation under load

---

## Deployment Architecture

### Container Composition

```
Docker Host (Single machine or Kubernetes cluster)

┌────────────────────────────────────────────────┐
│ agrisense-network (Docker bridge network)      │
├────────────────────────────────────────────────┤
│                                                │
│ ┌──────────────────┐  ┌──────────────────┐   │
│ │ postgres:15      │  │ influxdb:2.7     │   │
│ │ Port 5432        │  │ Port 8086        │   │
│ │                  │  │                  │   │
│ │ ├─ users         │  │ ├─ sensor_data   │   │
│ │ ├─ devices       │  │ └─ aggregates    │   │
│ │ └─ rules         │  │                  │   │
│ └──────────────────┘  └──────────────────┘   │
│                                                │
│ ┌──────────────────┐  ┌──────────────────┐   │
│ │ redis:7          │  │ emqx:5.3         │   │
│ │ Port 6379        │  │ Port 1883        │   │
│ │                  │  │ Port 18083       │   │
│ │ ├─ cache         │  │                  │   │
│ │ ├─ streams       │  │ ├─ MQTT broker   │   │
│ │ └─ counters      │  │ └─ Dashboard     │   │
│ └──────────────────┘  └──────────────────┘   │
│                                                │
│ ┌──────────────────┐  ┌──────────────────┐   │
│ │ agrisense-api    │  │ agrisense-mqtt   │   │
│ │ Port 8080        │  │ (background)     │   │
│ │                  │  │                  │   │
│ │ ├─ REST API      │  │ ├─ Message proc  │   │
│ │ ├─ WebSocket     │  │ ├─ Rule engine   │   │
│ │ └─ Frontend      │  │ └─ InfluxDB      │   │
│ └──────────────────┘  └──────────────────┘   │
│                                                │
└────────────────────────────────────────────────┘
```

### Local Development

```bash
# Start all dependencies
docker-compose -f deployments/docker-compose.yml up -d

# Expected output
Creating agrisense-postgres   ... done
Creating agrisense-influxdb   ... done
Creating agrisense-redis      ... done
Creating agrisense-emqx       ... done

# Container health check
docker ps

# Run API server (Terminal 1)
go run cmd/server/main.go
# Output: Server listening on :8080

# Run MQTT handler (Terminal 2)
go run cmd/mqtt-handler/main.go
# Output: Connected to EMQX, subscribed to device/#

# Run frontend (Terminal 3)
cd web && npm run dev
# Output: Frontend listening on :3000
```

### Production Deployment

```yaml
# kubernetes/agrisense-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agrisense-api
spec:
  replicas: 3  # Horizontal scaling
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
      - name: api
        image: agrisense-api:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: agrisense-config
              key: db_host
```

---

## Performance Characteristics

### Latency Targets

| Operation | Latency | Notes |
|-----------|---------|-------|
| **Cache Lookup** | < 5 ms | Redis hit |
| **Sensor Data Ingestion** | < 100 ms | Device → Storage |
| **Rule Evaluation** | < 50 ms | Per device |
| **Alert Trigger** | < 500 ms | Including notification |
| **WebSocket Broadcast** | < 100 ms | To 1000 subscribers |
| **API Response (cached)** | < 50 ms | REST endpoint |
| **API Response (fresh)** | 50-200 ms | Database query |
| **Time-series Query** | 50-200 ms | InfluxDB |

### Throughput Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| **Device Connections** | 10,000+ | EMQX clustering |
| **Messages/Second** | 1,000+ | Batch processing |
| **Data Points/Second** | 10,000+ | InfluxDB optimization |
| **API Requests/Second** | 1,000+ | Load balancer + replicas |
| **WebSocket Subscribers** | 5,000+ | Redis pub/sub |
| **Rules Evaluated/Sec** | 5,000+ | Go goroutines |

### Resource Utilization

**Single Instance (Production-like)**

```
Container          Memory    CPU     Network
────────────────────────────────────────────
postgres           512 MB    20%     Variable
influxdb           512 MB    25%     Variable
redis              256 MB    5%      Low
emqx              1024 MB    30%     High (device data)
api-server         256 MB    40%     High (API traffic)
mqtt-handler       256 MB    35%     High (message processing)
────────────────────────────────────────────
Total             ~3 GB      ~30%    Depends on scale
```

### Scalability Bottlenecks & Solutions

| Bottleneck | Issue | Solution |
|-----------|-------|----------|
| **EMQX connections** | Single broker has limits | Cluster EMQX with multiple nodes |
| **PostgreSQL writes** | Replication lag | Connection pooling, write optimization |
| **InfluxDB storage** | Growing disk usage | Retention policies, downsampling |
| **API throughput** | Single server limits | Load balancer + horizontal scaling |
| **Redis memory** | In-memory limits | Cluster Redis, eviction policy |
| **Storage capacity** | Data grows constantly | Archive old data, compression |

---

## Monitoring & Observability

### Metrics Collected (Prometheus)

```
agrisense_devices_connected    # Active device connections
agrisense_messages_received    # MQTT messages received
agrisense_alerts_triggered     # Alerts generated
agrisense_api_requests_total   # API request count
agrisense_api_latency_seconds  # Response time histogram
agrisense_database_errors      # Query failures
agrisense_cache_hits           # Redis hit rate
```

### Logging Strategy

```
Structured Logging (JSON format)

{
  "timestamp": "2026-04-17T10:30:45Z",
  "level": "info",
  "service": "mqtt-handler",
  "message": "telemetry received",
  "device_id": "sensor-001",
  "sensor_value": 28.5,
  "duration_ms": 12,
  "trace_id": "xyz789"
}
```

**Log Destinations:**
- Console (development)
- File (production)
- ELK Stack (optional)
- CloudWatch (AWS)

---

## Future Scalability Enhancements

### Short-term (3-6 months)

- [ ] Load balancer for API servers
- [ ] API horizontal scaling (2-3 replicas)
- [ ] Redis replication
- [ ] Database connection pooling optimization

### Medium-term (6-12 months)

- [ ] EMQX cluster (2-3 nodes)
- [ ] PostgreSQL read replicas
- [ ] InfluxDB enterprise for clustering
- [ ] Kafka for event streaming (instead of Redis)

### Long-term (1+ year)

- [ ] Kubernetes deployment
- [ ] Multi-region deployment
- [ ] GraphQL federation
- [ ] Machine learning for anomaly detection
- [ ] Edge computing (MQTT bridge)

---

## Technology Decision Records (TDRs)

### TDR-001: Why Go?

**Decision**: Use Go for backend implementation

**Rationale**:
- ✅ Excellent goroutine concurrency (goroutines >> threads)
- ✅ Fast startup time (compiled binary)
- ✅ Rich standard library (no heavy dependencies)
- ✅ Performance comparable to Rust with simpler syntax
- ✅ Easy deployment (single binary)
- ✅ Mature ecosystem (Gin, GORM, etc.)

**Alternatives Considered**:
- Node.js: Good for I/O, but memory inefficient for 10k connections
- Rust: Better performance, steeper learning curve
- Python: Slower, harder to scale

---

### TDR-002: Why EMQX over Mosquitto?

**Decision**: Use EMQX as MQTT broker

**Rationale**:
- ✅ Built for clustering (scale to multiple nodes)
- ✅ Better authentication/authorization
- ✅ Web management UI
- ✅ Metrics & monitoring built-in
- ✅ Enterprise support available
- ✅ Handles 10k+ connections reliably

**Trade-off**: Slightly higher resource usage than Mosquitto

---

### TDR-003: Why InfluxDB over Prometheus?

**Decision**: Use InfluxDB for time-series data

**Rationale**:
- ✅ Designed for IoT sensor data (metrics)
- ✅ Better compression ratio (80-90%)
- ✅ Flexible tag model for device metadata
- ✅ Faster writes for high volume
- ✅ Retention policies (auto-cleanup)
- ✅ SQL-like query language

**Use Case Fit**:
- Prometheus: Good for system metrics (CPU, memory)
- InfluxDB: Better for sensor readings (temperature, humidity)

---

### TDR-004: Why PostgreSQL + InfluxDB (not just PostgreSQL)?

**Decision**: Use separate databases (hybrid approach)

**Rationale**:
- PostgreSQL: Excellent for OLTP (user data, rules, alerts)
- InfluxDB: Excellent for OLAP (sensor history, analytics)

**Benefits**:
- ✅ PostgreSQL optimized for updates/transactions
- ✅ InfluxDB optimized for time-series reads
- ✅ Avoid schema bloat
- ✅ Different backup strategies

---

## Summary Checklist

Use this checklist to understand the architecture:

- [ ] Device layer sends MQTT telemetry
- [ ] EMQX broker routes to subscribers
- [ ] MQTT Handler processes messages
- [ ] Data stored in InfluxDB (time-series) and Redis (cache)
- [ ] Rule Engine evaluates alerts
- [ ] Alert Service generates notifications
- [ ] PostgreSQL stores metadata
- [ ] API Server provides REST + WebSocket
- [ ] Frontend connects via WebSocket for real-time
- [ ] Control commands flow back through MQTT

---

## References

- [EMQX Documentation](https://www.emqx.io/docs)
- [InfluxDB Time-Series Best Practices](https://docs.influxdata.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Streams](https://redis.io/topics/streams-intro)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)

---

**Document Maintained By**: Development Team  
**Last Review**: April 2026  
**Next Review**: July 2026
