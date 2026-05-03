# Project Structure

## Repository Layout

```bash
AgriSenseIoT/
├── cmd/                          # Main applications
│   ├── server/                   # Main API server
│   │   └── main.go
│   ├── mqtt-handler/             # MQTT message processor
│   │   └── main.go
│   └── rule-engine/              # Alert rule engine (separate service)
│       └── main.go
│
├── internal/                      # Private application code
│   ├── domain/                    # Core business entities
│   │   ├── user.go
│   │   ├── device.go
│   │   ├── sensor.go
│   │   ├── alert.go
│   │   └── command.go
│   │
│   ├── repository/                # Database interfaces & implementations
│   │   ├── postgres/              # PostgreSQL repositories
│   │   │   ├── user_repo.go
│   │   │   ├── device_repo.go
│   │   │   ├── alert_repo.go
│   │   │   └── migrations/        # SQL migration files
│   │   │       ├── 001_init.sql
│   │   │       └── 002_add_indexes.sql
│   │   ├── influxdb/              # Time-series repository
│   │   │   └── sensor_repo.go
│   │   └── redis/                  # Cache repository
│   │       ├── cache_repo.go
│   │       └── stream_repo.go
│   │
│   ├── service/                    # Business logic
│   │   ├── auth/                   
│   │   │   └── service.go          # JWT, authentication
│   │   ├── device/
│   │   │   └── service.go          # Device management
│   │   ├── data/
│   │   │   └── service.go          # Sensor data processing
│   │   ├── alert/
│   │   │   └── service.go          # Alert evaluation
│   │   ├── control/
│   │   │   └── service.go          # Command dispatch
│   │   └── automation/
│   │       └── service.go          # Automation rules
│   │
│   ├── handler/                     # HTTP handlers (API endpoints)
│   │   ├── rest/
│   │   │   ├── auth_handler.go
│   │   │   ├── device_handler.go
│   │   │   ├── data_handler.go
│   │   │   ├── alert_handler.go
│   │   │   └── control_handler.go
│   │   └── websocket/
│   │       └── handler.go           # WebSocket connections
│   │
│   ├── mqtt/                         # MQTT client & handlers
│   │   ├── client.go
│   │   ├── handlers/
│   │   │   ├── telemetry.go
│   │   │   ├── heartbeat.go
│   │   │   └── response.go
│   │   └── topics.go                 # MQTT topic constants
│   │
│   ├── ruleengine/                    # Rule evaluation engine
│   │   ├── engine.go
│   │   ├── evaluator.go
│   │   └── rules/
│   │       ├── threshold.go
│   │       └── composite.go
│   │
│   ├── middleware/                     # HTTP middleware
│   │   ├── auth.go                      # JWT auth
│   │   ├── logger.go                     # Request logging
│   │   ├── cors.go
│   │   └── rate_limit.go
│   │
│   └── config/                          # Configuration
│       └── config.go
│
├── pkg/                                 # Public libraries (can be used by other projects)
│   ├── mqttclient/                       # Reusable MQTT client
│   └── utils/                             # Helper functions
│       ├── time.go
│       └── validator.go
│
├── web/                                   # Frontend (Vue/React)
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── store/
│   │   ├── api/                           # Frontend API client
│   │   └── assets/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── deployments/                            # Deployment configurations
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.mqtt
│   │   └── Dockerfile.rule-engine
│   ├── docker-compose.yml                   # Local development
│   ├── docker-compose.prod.yml              # Production
│   └── init/
│       ├── postgres/                         # Init scripts
│       │   └── init.sql
│       └── influxdb/
│           └── init.iql
│
├── docs/                                    # Documentation (we're here)
│   ├── problem.md
│   ├── requirements.md
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── structure.md                         # This file
│
├── scripts/                                  # Build & utility scripts
│   ├── build.sh
│   ├── test.sh
│   ├── migrate.sh                            # Database migrations
│   └── generate-device-simulator/           # Device simulator for testing
│       └── main.go
│
├── test/                                     # External tests
│   ├── integration/
│   └── load/                                 # Load testing scripts
│       └── k6-script.js
│
├── .env.example                               # Environment variables template
├── .gitignore
├── go.mod
├── go.sum
├── Makefile                                    # Common tasks
└── README.md                                   # Project overview

```

---

## Package Responsibilities

### `/cmd`
Each subdirectory is a **main package** that builds to a binary.
- `server/`: Main HTTP + WebSocket server
- `mqtt-handler/`: Dedicated MQTT message processor (can be scaled separately)
- `rule-engine/`: Separate service for alert evaluation (optional, can be within server initially)

### `/internal`
Private code that shouldn't be imported by other projects.

#### `internal/domain/`
Pure business entities with NO external dependencies.
```go
// Example: device.go
package domain

type Device struct {
    ID           int
    DeviceID     string
    Name         string
    Type         string
    Status       string
    LastHeartbeat time.Time
    Config       map[string]interface{}
}

type DeviceRepository interface {
    Create(device *Device) error
    FindByID(id int) (*Device, error)
    FindByDeviceID(deviceID string) (*Device, error)
    Update(device *Device) error
    List(userID int, page, limit int) ([]Device, int64, error)
}
```

#### `internal/repository/`
Implementations of domain interfaces.
- **PostgreSQL**: User, Device, Alert, Automation repositories
- **InfluxDB**: Sensor data repository (time-series)
- **Redis**: Cache and real-time streams

#### `internal/service/`
Business logic orchestration.
```go
// Example: device/service.go
type Service struct {
    deviceRepo domain.DeviceRepository
    cacheRepo  redis.CacheRepository
}

func (s *Service) RegisterDevice(ctx context.Context, d *domain.Device) error {
    // Business logic: validate, check duplicate, etc.
    // Then save to database
    return s.deviceRepo.Create(d)
}
```

#### `internal/handler/`
HTTP/WebSocket request handlers.
- Parse request
- Call service
- Format response
- No business logic here

#### `internal/mqtt/`
MQTT client management.
- Connection to EMQX broker
- Subscribe to topics
- Route messages to appropriate handlers

#### `internal/ruleengine/`
Alert evaluation engine.
- Load rules from database
- Evaluate incoming data against rules
- Trigger alerts when conditions met

---

## Dependency Flow

```
HTTP Request → Handler → Service → Repository → Database
                 ↑
WebSocket  ──────┘

MQTT Message → MQTT Handler → Service → Repository → Database
                               ↓
                         Rule Engine (if needed)
```

**Direction**: Dependencies point inward:
- `handler` → `service` → `repository` → `domain` (interfaces)
- `service` → `domain` (entities)
- No circular dependencies

---

## Configuration Management

`.env.example`:
```env
# Server
PORT=8080
ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=agrisense
DB_SSL_MODE=disable

# InfluxDB
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=my-token
INFLUXDB_ORG=my-org
INFLUXDB_BUCKET=sensor_data

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# MQTT
MQTT_BROKER=tcp://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# EMQX Auth (if using HTTP auth)
EMQX_AUTH_URL=http://localhost:8080/api/v1/mqtt/auth
```

---

## Makefile Commands

```makefile
.PHONY: run test build migrate

run:
	go run cmd/server/main.go

test:
	go test ./... -v

build:
	go build -o bin/server cmd/server/main.go
	go build -o bin/mqtt-handler cmd/mqtt-handler/main.go

migrate-up:
	go run scripts/migrate/main.go up

migrate-down:
	go run scripts/migrate/main.go down

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

lint:
	golangci-lint run

gen-mocks:  # For testing
	mockery --all --dir internal/domain
```

---

## Why This Structure?

| Principle | How This Structure Follows It |
|-----------|------------------------------|
| **Separation of Concerns** | Each layer has clear responsibility |
| **Dependency Injection** | Services receive repository interfaces |
| **Testability** | Domain has no dependencies, easy to mock |
| **Clean Architecture** | Domain is the center, external concerns at edges |
| **Scalability** | Can split into microservices later (cmd/*) |
| **Standard Go Layout** | Follows community conventions |

This structure is production-ready and used by many real-world Go projects.