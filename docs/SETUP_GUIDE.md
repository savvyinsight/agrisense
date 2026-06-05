# AgriSense Development Setup Guide

This guide walks new contributors through setting up the development environment and creating the first platform admin account.

## Prerequisites

- Docker & Docker Compose
- Go 1.25+ (for backend development)
- Node.js 18+ (for frontend development)
- Make
- Git

## Quick Start (5 minutes)

### 1. Clone and Configure

```bash
git clone https://github.com/savvyinsight/agrisense.git
cd agrisense

# Copy environment template
cd backend
cp .env.example .env
cd ..
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, InfluxDB, EMQX, and monitoring services
make docker-up
```

This command:
- Creates and starts all Docker containers
- Runs database migrations automatically
- Waits for services to be ready

Expected output: All 7 containers running (postgres, redis, influxdb, emqx, prometheus, grafana)

### 3. Create Platform Admin Account

The platform admin is the superuser who manages accounts, users, and system-wide settings. Create it before starting the backend:

```bash
cd backend
go run ./cmd/agrisense admin create \
  --email admin@agrisense.local \
  --password "AgriSense@123" \
  --username admin
```

**Output:**
```
Admin user created: admin@agrisense.local (id=1)
```

**Important:**
- This command only works if no admin exists yet
- The email must be unique
- Password must be at least 6 characters (use strong password in production)
- Write these credentials down — you'll need them to log in

### 4. Start Backend Server

```bash
cd backend
go run ./cmd/agrisense
```

Expected output:
```
2026/06/05 14:51:33 Database schema at version 20
[GIN-debug] GET    /api/v1/devices           --> ...
2026/06/05 14:51:35 HTTP server starting on port 8080
```

Backend is now running at `http://localhost:8080`

### 5. Start Frontend Server

In a new terminal:

```bash
cd frontend
npm install  # First time only
npm run dev
```

Expected output:
```
VITE v7.3.3  ready in 243 ms
➜  Local:   http://localhost:5173/
```

Frontend is now running at `http://localhost:5173`

## Testing Your Setup

### Login as Admin

1. Open `http://localhost:5173` in your browser
2. Login with:
   - Email: `admin@agrisense.local`
   - Password: `AgriSense@123`
3. You should see the dashboard with access to platform admin features

### Verify API Access

```bash
# Health check
curl http://localhost:8080/health

# List all accounts (admin only)
TOKEN="<your_jwt_token_from_login>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/admin/accounts
```

### Run Tests

```bash
# Backend unit tests
cd backend
go test ./... -v

# Backend integration tests (requires Docker)
go test -tags=integration ./... -v

# Frontend tests
cd frontend
npm test
```

## Development Workflow

### Backend Development

```bash
# Terminal 1: Start services
make docker-up

# Terminal 2: Start backend
cd backend
go run ./cmd/agrisense

# Edit code and test
cd backend
go test ./internal/user -v
```

### Frontend Development

```bash
# Terminal 1: Start frontend dev server
cd frontend
npm run dev

# Open http://localhost:5173
# Changes auto-reload in browser
```

### Linting and Type Checking

```bash
# Backend lint
cd backend
golangci-lint run ./...

# Frontend lint and type check
cd frontend
npm run lint
npx tsc --noEmit
```

## Common Issues

### Issue: "bind: address already in use" on port 8080

**Solution:**
```bash
# Kill process using port 8080
lsof -i :8080 | tail -1 | awk '{print $2}' | xargs kill -9

# Or stop and restart Docker
docker-compose down -v && docker-compose up -d
```

### Issue: Database migrations fail

**Solution:**
```bash
# Check Docker logs
docker logs agrisense-postgres

# Reset database and migrations
docker-compose down -v
docker-compose up -d
# Migrations run automatically
```

### Issue: "email already registered" when creating admin

**Solution:** The admin account already exists. To reset:
```bash
# Clear database completely
docker-compose down -v
docker-compose up -d

# Then create admin again
go run ./cmd/agrisense admin create --email admin@agrisense.local --password "AgriSense@123"
```

### Issue: Frontend cannot connect to backend

**Solution:** Check that:
1. Backend is running: `curl http://localhost:8080/health`
2. Frontend proxy is configured correctly in `vite.config.ts`
3. CORS is enabled (should allow localhost:5173)

## Admin Account Concepts

### What is a Platform Admin?

A platform admin (in the `platform_admins` table) is different from a regular user with admin role:

- **Platform Admin**: System superuser with unrestricted access to:
  - All accounts and users across the platform
  - Global audit logs
  - Platform statistics
  - System configuration

- **Account Admin**: User-level role within a specific account/farm:
  - Manages users and permissions within their account
  - Cannot see other accounts' data

### JWT Claims

When logged in, the JWT token includes:

```json
{
  "user_id": 1,
  "email": "admin@agrisense.local",
  "is_platform_admin": true,
  "role": "admin",
  "account_id": null
}
```

Only users with `is_platform_admin: true` can access `/api/v1/admin/*` endpoints.

## Useful Commands

```bash
# View Makefile targets
make help

# Build backend binary
cd backend && go build -o bin/agrisense cmd/agrisense/main.go

# Seed test data (creates farm, fields, devices)
cd backend && make seed

# Simulate device telemetry
cd backend && make simulate-all

# View Docker logs
docker-compose logs -f postgres  # or any service name

# Connect to database
docker exec -it agrisense-postgres psql -U agrisense -d agrisense_db

# View Redis cache
docker exec -it agrisense-redis redis-cli

# View Prometheus metrics
curl http://localhost:9090

# Access Grafana
# http://localhost:3000 (admin/admin)
```

## Architecture Overview

See [docs/architecture.md](architecture.md) for system design and [docs/api.md](api.md) for API documentation.

## Next Steps

1. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for coding conventions
2. Check [docs/architecture-overview.md](architecture-overview.md) for system design
3. Review [AGENTS.md](../AGENTS.md) for command reference and project structure
4. Start with a small bug fix or documentation improvement

## Getting Help

- **Issues**: Check [GitHub Issues](https://github.com/savvyinsight/agrisense/issues)
- **Discussions**: Open a [GitHub Discussion](https://github.com/savvyinsight/agrisense/discussions)
- **Code Review**: PRs are reviewed within 24-48 hours

Happy coding! 🌱
