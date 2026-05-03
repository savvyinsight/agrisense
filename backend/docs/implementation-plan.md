# Implementation Plan

## Development Phases

We'll build AgriSenseIoT in **7 iterations**, each delivering working, testable functionality.

---

## Iteration 1: Project Setup & Basic Infrastructure (Week 1)

**Goal**: Working development environment with all services running.

### Tasks
- [x] Initialize Go module: `go mod init github.com/yourname/agrisenseiot`
- [x] Create project structure (folders from `structure.md`)
- [x] Write base configuration loader (`internal/config/config.go`)
- [x] Create Docker Compose for all dependencies:
  - PostgreSQL
  - InfluxDB
  - Redis
  - EMQX
- [x] Write initialization scripts for databases
- [x] Create Makefile with basic commands (run, test, docker-up)
- [x] Test connectivity between services

### Deliverables
```
- Running: PostgreSQL, InfluxDB, Redis, EMQX via docker-compose
- Config loads from .env
- `make docker-up` works
```

### Success Criteria
```bash
docker-compose ps  # All services healthy
go run cmd/server/main.go  # Starts without panic
```

---

## Iteration 2: Domain Models & Database Layer (Week 2)

**Goal**: Data layer complete with repositories and migrations.

### Tasks
- [x] Write domain entities (`internal/domain/`)
  - `user.go`
  - `device.go`
  - `sensor.go`
  - `alert.go`
  - `command.go`
- [x] Write repository interfaces in domain
- [x] Implement PostgreSQL repositories (`internal/repository/postgres/`)
  - Connection pool setup
  - User repository (CRUD)
  - Device repository (CRUD + status updates)
  - Alert rule repository
- [x] Write database migrations (`internal/repository/postgres/migrations/`)
  - `001_init.sql` (all tables from database.md)
  - `002_add_indexes.sql`
- [x] Implement InfluxDB repository (`internal/repository/influxdb/`)
  - Write single data point
  - Batch write
  - Query by time range
- [x] Implement Redis repository (`internal/repository/redis/`)
  - Latest reading cache
  - Device status cache
- [x] Write repository tests (with test containers)

### Deliverables
```
- All database tables created
- Repositories can CRUD data
- `make migrate-up` works
- Tests pass: `go test ./internal/repository/...`
```

---

## Iteration 3: MQTT Integration & Device Communication (Week 3)

**Goal**: Devices can connect, authenticate, and send data.

### Tasks
- [x] Implement MQTT client (`internal/mqtt/client.go`)
- [x] Connect to EMQX broker
- [x] Subscribe to device topics:
  - `device/+/telemetry`
  - `device/+/heartbeat`
  - `device/+/response`
- [x] Implement MQTT handlers:
  - `telemetry.go` - Parse and validate incoming sensor data
  - `heartbeat.go` - Update device last_seen status
  - `response.go` - Handle command acknowledgments
- [ ] Create device authentication (JWT or device credentials)
- [ ] xxxxxxxxxx -- Example: Partition alerts by monthCREATE TABLE alerts_partitioned (    LIKE alerts INCLUDING DEFAULTS) PARTITION BY RANGE (triggered_at);​-- Create monthly partitionsCREATE TABLE alerts_2024_01 PARTITION OF alerts_partitioned    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');sql
- [x] Write device simulator (`scripts/generate-device-simulator/`)
  - Simulate 10 devices sending data every 30 seconds
- [x] Test data flow: Simulator → EMQX → MQTT Handler → Services

### Deliverables
```
- Devices can connect and authenticate
- Telemetry data flows to handlers
- Device status updates in Redis + PostgreSQL
- Simulator running
```

---

## Iteration 4: Data Processing & Storage (Week 4)

**Goal**: Incoming data is validated, cached, and stored.

### Tasks
- [x] Create data service (`internal/service/data/service.go`)
- [x] Implement validation logic (schema, ranges)
- [x] Store latest reading in Redis
- [x] Store time-series data in InfluxDB (batch for performance)
- [x] Implement data query API:
  - `GET /api/v1/devices/{id}/latest`
  - `GET /api/v1/devices/{id}/data`
- [x] Add data aggregation (min, max, avg over time)
- [x] Write integration tests for data pipeline

### Data Flow Complete:
```
Device → EMQX → MQTT Handler → Data Service → Redis (latest)
                                         ↓
                                    InfluxDB (history)
                                         ↓
                                    API for queries
```

### Deliverables
```
- Data flows end-to-end
- Can query historical data via API
- Redis caches latest readings
```

---

## Iteration 5: REST API & WebSocket (Week 5)

**Goal**: Complete API for web frontend.

### Tasks
- [x] Implement JWT authentication (`internal/service/auth/`)
  - Register
  - Login
  - Token validation middleware
- [x] Create REST handlers (`internal/handler/rest/`)
  - `auth_handler.go` - Login/register endpoints
  - `device_handler.go` - CRUD for devices
  - `data_handler.go` - Query sensor data
  - `alert_handler.go` - CRUD for alert rules
  - `control_handler.go` - Send commands
- [x] Implement WebSocket handler (`internal/handler/websocket/`)
  - Connection upgrade
  - Authentication
  - Subscribe to device updates
  - Broadcast live data
- [ ] Add middleware:
  - `auth.go` - JWT validation
  - `logger.go` - Request logging
  - `cors.go` - CORS for frontend
  - `rate_limit.go` - Rate limiting
- [ ] Write API tests (using httptest)

### Deliverables
```
- Complete REST API from api.md
- WebSocket for live updates
- Postman/curl can test all endpoints
```

---

## Iteration 6: Rule Engine & Alerts (Week 6)

**Goal**: Alert rules evaluate incoming data and trigger notifications.

### Tasks
- [ ] Implement rule engine (`internal/ruleengine/`)
  - `engine.go` - Main evaluation loop
  - `evaluator.go` - Condition checking
  - `threshold.go` - Threshold rules
  - `composite.go` - AND/OR combinations
- [x] Load rules from database (with caching)
- [x] Connect rule engine to data pipeline
- [ ] Implement alert service (`internal/service/alert/`)
  - Create alert records
  - WebSocket notifications (real-time)
  - Email notifications (SMTP)
  - Alert acknowledgment
- [x] Create alert history API
- [ ] Test alert latency and accuracy

### Flow:
```
Data → Rule Engine → Match? → Yes → Create Alert → Notify (WS/Email)
                                         ↓
                                    Store in PostgreSQL
```

### Deliverables
```
- Rules trigger alerts based on thresholds
- Alerts appear in WebSocket instantly
- Alert history queryable
```

---

## Iteration 7: Control & Automation (Week 7)

**Goal**: Remote control and automated actions.

### Tasks
- [x] Implement control service (`internal/service/control/`)
  - Command creation
  - Send via MQTT
  - Track status (pending → sent → delivered → executed)
- [ ] Add command API endpoints
- [ ] Implement automation service (`internal/service/automation/`)
  - Load automation rules
  - Evaluate sensor triggers
  - Generate commands automatically
- [ ] Add cron-based scheduled actions
- [ ] Implement command status WebSocket updates
- [ ] Test end-to-end: Rule → Automation → Command → Device

### Deliverables
```
- Manual control via API
- Auto-irrigation working (simulated)
- Command status tracking complete
```

---

## Iteration 8: Testing & Optimization (Week 8)

**Goal**: Production-ready with performance testing.

### Tasks
- [x] Integration tests for all flows
- [x] Load testing with k6 (`test/load/`)
  - 1000 concurrent devices
  - 100 msg/sec
- [x] Performance profiling (pprof)
- [ ] Database query optimization (EXPLAIN, indexes)
- [x] Add Prometheus metrics
- [ ] Structured logging (JSON format)
- [x] Error handling review
- [ ] Security audit (SQL injection, XSS, etc.)

### Performance Targets
| Metric | Target |
|--------|--------|
| Device connections | 5000+ |
| Message throughput | 1000/sec |
| Alert latency | < 2 seconds |
| API response time | < 200ms |

---

## Iteration 9: Deployment & Documentation (Week 9)

**Goal**: Production-ready deployment and comprehensive documentation

### Tasks
- [ ] Write complete README with setup instructions
- [ ] Create production Docker Compose config
- [ ] Deploy to VPS or cloud
- [ ] Add SSL/TLS
- [ ] Create demo video/screenshots
- [ ] Document API endpoints

---



## Iteration 10: Frontend Basic (Week 9) - Optional

**Goal**: Basic web dashboard if time permits.

### Tasks
- [ ] Initialize Vue/React project in `/web`
- [ ] Create login/register pages
- [ ] Device list view
- [ ] Real-time dashboard with charts
- [ ] Map view (if PostGIS used)
- [ ] Alert management UI

---

## Daily Development Workflow

```bash
# Start dependencies
make docker-up

# Run migrations
make migrate-up

# Run the server (with auto-reload for development)
air  # or: go run cmd/server/main.go

# Run tests
make test

# Commit working code
git add .
git commit -m "feature: add X functionality"
```

---

## Definition of Done

For each iteration:
- [ ] Code compiles without errors
- [ ] Tests pass (`go test ./...`)
- [ ] API works (manual test with curl)
- [ ] Documentation updated if needed
- [ ] Committed to git

---

