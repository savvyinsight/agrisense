# AgriSenseIoT 🌱

IoT-based Agricultural Equipment Monitoring and Data Analysis Platform.

[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8)](https://golang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 📋 Overview

AgriSenseIoT is a production-ready IoT platform that enables real-time monitoring and control of agricultural environments. It collects data from sensors (temperature, humidity, soil moisture, light), processes it through a rule engine, triggers alerts, and allows remote control of actuators.

### ✨ Features

- **Device Management** - Register, authenticate, and monitor IoT devices
- **Real-time Data** - MQTT-based telemetry with Redis caching
- **Time-series Storage** - InfluxDB for historical sensor data
- **Smart Alerts** - Configurable rule engine with threshold-based alerts
- **Remote Control** - Send commands to devices with status tracking
- **REST API** - Full CRUD operations with JWT authentication
- **WebSocket** - Live updates for dashboards
- **Metrics & Monitoring** - Prometheus endpoints, structured logging
- **Dockerized** - Easy deployment with docker-compose

## 🏗 Architecture

![Architecture Diagram](docs/image/Layer Architecture.png)

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Go 1.21+ (for development)
- Make

### Installation

```bash
# Clone repository
git clone https://github.com/savvyinsight/agrisenseiot.git
cd agrisenseiot

# Download dependencies (go.mod & go.sum are committed to repo)
go mod download

# Copy environment configuration
cp .env.example .env

# Start all services
make docker-up

# Run database migrations (auto-runs on docker-up, or manual:)
make migrate-up

# Start the API server (terminal 1)
go run cmd/server/main.go

# Start MQTT handler (terminal 2)
go run cmd/mqtt-handler/main.go

# Run device simulator (terminal 3)
go run scripts/generate-device-simulator/main.go

# Register a user
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"test123"}'

# Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
# Save the token from response

# Create a device
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"sensor-001","name":"Greenhouse Sensor","type":"sensor"}'
```

📚 API Documentation
Full API documentation is available in docs/api.md

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login and get JWT |
| GET  | `/api/v1/devices` | List all devices |
| POST | `/api/v1/devices` | Register new device |
| GET  | `/api/v1/devices/:id/data/latest` | Get latest sensor reading |
| POST | `/api/v1/alerts/rules` | Create alert rule |
| GET  | `/api/v1/alerts/active` | Get active alerts |
| POST | `/api/v1/devices/:id/commands` | Send command to device |


🧪 Testing

# Run all tests

go test ./... -v

# Run load tests (requires k6)

k6 run test/load/k6-script.js

# Check test coverage

go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

📊 Monitoring

Metrics: <http://localhost:8080/metrics> (Prometheus format)

Profiling: <http://localhost:8080/debug/pprof/>

EMQX Dashboard: <http://localhost:18083> (admin/public)

🚢 Production Deployment
See DEPLOYMENT.md for production setup instructions.

🛠 Built With
Go - Backend services

Gin - Web framework

EMQX - MQTT broker

PostgreSQL - Relational database

InfluxDB - Time-series database

Redis - Caching and real-time streams

Docker - Containerization

Prometheus - Metrics collection

📈 Performance

Handles 2,300+ requests/second ✅ **ACHIEVED**

**Validation Results:**
- Actual throughput: 2,305 messages/second
- P95 latency: < 6ms
- Error rate: 0%
- Tested with 100 concurrent devices

See [Performance Results](docs/PERFORMANCE-RESULTS.md) for detailed optimization analysis.

📝 License

MIT License - see LICENSE file

👨‍🌾 Author

Your Richie - @savvyinsight

🙏 Acknowledgments

Thanks to all the open-source projects that made this possible

Inspired by real-world agricultural IoT needs
