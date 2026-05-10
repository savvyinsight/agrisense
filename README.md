# AgriSense — Open IoT Platform for Smart Agriculture

[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-19+-61DAFB)](https://react.dev)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/savvyinsight/agrisense/actions/workflows/ci.yml/badge.svg)](https://github.com/savvyinsight/agrisense/actions/workflows/ci.yml)

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
│   ├── cmd/                  # Executables (API server, MQTT handler)
│   ├── internal/             # Business logic and adapters
│   ├── deployments/          # Docker, nginx, Prometheus configs
│   ├── test/                 # Integration & load tests
│   ├── scripts/              # Database, device simulator scripts
│   └── go.mod
│
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable UI components
│   │   ├── api/             # API client functions
│   │   └── hooks/           # Custom React hooks
│   └── package.json
│
├── docker-compose.yml        # Local development stack
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (for full stack)
- **Go 1.21+** (for backend development)
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

4. **Start backend services in separate terminals**
   ```bash
   # Terminal 1: API Server
   go run cmd/server/main.go

   # Terminal 2: MQTT Handler
   go run cmd/mqtt-handler/main.go

   # Terminal 3: Device Simulator (for testing)
   go run scripts/generate-device-simulator/main.go
   ```

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

- [Backend README](backend/README.md) — Architecture, API docs, deployment
- [Frontend README](frontend/README.md) — UI setup, component structure
- [API Reference](backend/docs/api.md) — Detailed API endpoints
- [Architecture Overview](backend/docs/architecture.md) — System design & flows
- [Deployment Guide](backend/DEPLOYMENT.md) — Production setup

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

See [DEPLOYMENT.md](backend/DEPLOYMENT.md) for containerized production setup with:
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

See [Performance Results](backend/docs/PERFORMANCE-RESULTS.md) for detailed benchmarks.

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## 📝 License

MIT License — see [LICENSE](LICENSE) file for details.

## 👨‍🌾 Authors

- **Richie** — [@savvyinsight](https://github.com/savvyinsight)

## 🙏 Acknowledgments

- [EMQX](https://www.emqx.io/) — MQTT broker
- [InfluxDB](https://www.influxdata.com/) — Time-series database
- [Gin](https://gin-gonic.com/) — Web framework
- [Material-UI](https://mui.com/) — UI components
