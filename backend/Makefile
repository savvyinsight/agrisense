.PHONY: run test docker-up docker-down migrate-up help

run:
	go run ./cmd/agrisense/

docker-up:
	docker compose -f deployments/docker-compose.yml up -d

docker-down:
	docker compose -f deployments/docker-compose.yml down

docker-logs:
	docker compose -f deployments/docker-compose.yml logs -f

migrate-up:
	@echo "Running database migrations..."
	@echo "Note: Migrations in init/postgres/ auto-run on container startup"
	@echo "If containers are already running, execute migrations inside container:"
	docker exec agrisense-postgres psql -U postgres -d agrisense -f /docker-entrypoint-initdb.d/001_init.sql

test:
	go test ./... -v

tidy:
	go mod tidy

simulate:
	@echo "Starting device simulators for irrigation controllers (bg)..."
	nohup go run ./scripts/generate-device-simulator/main.go D260517-QSPO D260517-I25Q &>simulator.log &
	@echo "Log: backend/simulator.log  |  tail -f simulator.log"

simulate-all:
	@echo "Starting all device simulators (bg)..."
	nohup go run ./scripts/generate-device-simulator/main.go sim-device-01 sim-device-02 sim-device-03 D260517-QSPO D260517-I25Q &>simulator.log &
	@echo "Log: backend/simulator.log  |  tail -f simulator.log"

help:
	@echo "Available commands:"
	@echo "  make run         - Start the server"
	@echo "  make docker-up   - Start all dependencies (PostgreSQL, InfluxDB, Redis, EMQX)"
	@echo "  make docker-down - Stop all dependencies"
	@echo "  make docker-logs - View dependency logs"
	@echo "  make migrate-up  - Run database migrations"
	@echo "  make test        - Run tests"
	@echo "  make tidy        - Tidy go modules"
	@echo "  make simulate    - Run device simulators for irrigation controllers"
	@echo "  make simulate-all- Run all device simulators (sensors + controllers)"
