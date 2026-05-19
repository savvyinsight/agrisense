# AgriSense — Open IoT Platform for Smart Agriculture

[![Go Version](https://img.shields.io/badge/Go-1.25.5-00ADD8)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-19.2.0-61DAFB)](https://react.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/savvyinsight/agrisense/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/savvyinsight/agrisense/actions/workflows/frontend-ci.yml)
[![CI](https://github.com/savvyinsight/agrisense/actions/workflows/backend-ci.yml/badge.svg)](https://github.com/savvyinsight/agrisense/actions/workflows/backend-ci.yml)

## 📋 Overview

AgriSense is a full-stack, open-source IoT platform for real-time agricultural monitoring and control. It ingests sensor data via MQTT, stores high-frequency metrics, processes data through an intelligent rule engine, triggers alerts, and provides a modern web dashboard with live visualization.

### ✨ Features

- **Device Management** — Register, authenticate, and monitor IoT devices
- **Real-time Data** — MQTT-based telemetry with Redis caching
- **Time-series Storage** — InfluxDB for historical sensor data
- **Smart Alerts** — Configurable rule engine with threshold-based triggers
- **Automation** — Schedule actions and trigger commands conditionally
- **Remote Control** — Send commands to devices with status tracking
- **REST API** — Full CRUD operations with JWT authentication
- **WebSocket** — Live updates for dashboards
- **Metrics & Monitoring** — Prometheus endpoints, structured logging, Grafana
- **Dockerized** — Easy local development and production deployment

## 🏗 Architecture

- **Backend**: Go + Gin framework, MQTT, PostgreSQL, InfluxDB, Redis
- **Frontend**: React + TypeScript + MUI, real-time WebSocket updates
- **Infrastructure**: Docker Compose, Prometheus, Grafana, EMQX MQTT broker

## 📂 Repository Structure

```
agrisense/
├── backend/                   # Go backend services
│   ├── cmd/                  # Executable entrypoint
│   ├── internal/             # Business logic and adapters
│   ├── deployments/          # Docker, nginx, Prometheus configs
│   ├── test/                 # Integration & load tests
│   ├── scripts/              # Database, device simulator scripts
│   └── go.mod
│
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── api/             # API client functions
│   │   ├── assets/          # Static images and styles
│   │   ├── features/        # Feature pages and views
│   │   ├── locales/         # Translations and i18n resources
│   │   ├── shared/          # Shared UI and utilities
│   │   ├── App.tsx
│   │   ├── i18n.ts
│   │   └── main.tsx
│   └── package.json
│
├── docs/                     # Centralized documentation
├── docker-compose.yml        # Local development stack
├── Makefile                  # Convenience commands
├── AGENTS.md                 # opencode agent instructions
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for full stack)
- **Go 1.25+** (for backend development)
- **Node.js 18+** (for frontend development)
- **Make** (for convenient commands)

### Local Development

1. **Clone and setup**
   ```bash
   git clone https://github.com/savvyinsight/agrisense.git
   cd agrisense
   ```

2. **Start infrastructure (PostgreSQL, InfluxDB, Redis, EMQX, Prometheus, Grafana)**
   ```bash
   docker-compose up -d
   ```

3. **Initialize database**
   ```bash
   cd backend
   make migrate-up
   ```

4. **Start the backend server**
   ```bash
   cd backend
   go run cmd/agrisense/main.go
   ```

   This launches the unified AgriSense backend, including the HTTP API, WebSocket hub, and MQTT handling.

5. **Start frontend (in separate terminal)**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Access services**
   - **Frontend**: http://localhost:5173
   - **API**: http://localhost:8080
   - **EMQX Dashboard**: http://localhost:18083 (admin/public)
   - **Prometheus**: http://localhost:9090
   - **Grafana**: http://localhost:3000 (admin/admin)

### Register a Test User

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test",
    "email": "test@example.com",
    "password": "test123"
  }'
```

### Login and Create a Device

```bash
# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123"}'

# Save the token from response, then create a device
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "sensor-001",
    "name": "Greenhouse Sensor",
    "type": "sensor"
  }'
```

## 📚 Documentation

All documentation lives under [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System design, components & data flows |
| [Architecture (Detailed)](docs/architecture-detailed.md) | In-depth architecture with visual diagrams |
| [Architecture Overview](docs/architecture-overview.md) | High-level system overview |
| [API Reference](docs/api.md) | Complete REST & WebSocket API reference |
| [Database](docs/database.md) | Schema design and migration guide |
| [Deployment](docs/deployment.md) | Production setup with Docker |
| [Monitoring](docs/monitoring.md) | Prometheus & Grafana observability |
| [Performance](docs/performance.md) | Benchmarks and scalability results |
| [Quick Reference](docs/quick-reference.md) | Daily development reference |
| [Handbook](docs/handbook.md) | Developer onboarding & handoff guide |
| [Multi-Tenant RBAC](docs/multi-tenant.md) | Multi-tenant design |
| [RBAC Summary](docs/rbac.md) | RBAC implementation details |
| [Backend Integration](docs/backend-integration.md) | Backend integration guide |
| [Testing Scenarios](docs/testing-scenarios.md) | Test personas and scenarios |
| [Requirements](docs/requirements.md) | Project requirements |
| [Implementation Plan](docs/implementation-plan.md) | Development roadmap |
| [Problem Statement](docs/problem.md) | Business context & motivation |

Sub-project READMEs: [Backend](backend/README.md) · [Frontend](frontend/README.md)

## 🧪 Testing

```bash
cd backend

# Run all tests
go test ./... -v

# Run tests with coverage
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# Run load tests (requires k6)
k6 run test/load/k6-script.js
```

## 📊 Monitoring

- **Prometheus Metrics**: http://localhost:9090
- **Grafana Dashboards**: http://localhost:3000
- **API Health Check**: http://localhost:8080/api/v1/health
- **Profiling**: http://localhost:8080/debug/pprof/

## 🚢 Production Deployment

See [Deployment Guide](docs/deployment.md) for containerized production setup with:
- Multi-stage Docker builds
- Nginx reverse proxy
- Environment-specific configs
- Health checks & auto-restart policies

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Go, Gin, MQTT, PostgreSQL, InfluxDB, Redis |
| **Frontend** | React, TypeScript, Material-UI, Vite |
| **Message Broker** | EMQX MQTT |
| **Monitoring** | Prometheus, Grafana |
| **Containerization** | Docker, Docker Compose |
| **API** | REST + WebSocket |

## 📈 Performance

- **Throughput**: 2,300+ requests/second ✅
- **P95 Latency**: < 6ms
- **Scalability**: Tested with 100+ concurrent devices

See [Performance Results](docs/performance.md) for detailed benchmarks.

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- PR process and code review
- Coding standards and conventions
- Development workflow
- Commit message format

## 📝 License

MIT License — see [LICENSE](LICENSE) file for details.

## 👨‍🌾 Authors

- **Richie** — [@savvyinsight](https://github.com/savvyinsight)

## 🙏 Acknowledgments

- [EMQX](https://www.emqx.io/) — MQTT broker
- [InfluxDB](https://www.influxdata.com/) — Time-series database
- [Gin](https://gin-gonic.com/) — Web framework
- [Material-UI](https://mui.com/) — UI components
