.PHONY: run test docker-up docker-down migrate-up help seed simulate simulate-all

run:
	go run ./cmd/agrisense/

docker-up:
	docker compose -f deployments/docker-compose.yml down --remove-orphans 2>/dev/null; docker compose -f deployments/docker-compose.yml up -d

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

seed:
	@echo "Seeding test data (account, fields, devices, zones)..."
	go run ./scripts/seed-test-data/

simulate:
	@echo "Starting device simulators for irrigation controllers (bg)..."
	-kill -9 $$(lsof -ti:1883 -c go) 2>/dev/null
	nohup go run ./scripts/generate-device-simulator/ CTRL-NTH CTRL-STH &>simulator.log &
	@echo "Log: backend/simulator.log  |  tail -f simulator.log"

simulate-all:
	@echo "Starting all device simulators (bg)..."
	-kill -9 $$(lsof -ti:1883 -c go) 2>/dev/null
	nohup go run ./scripts/generate-device-simulator/ SEN-NTH-TEMP SEN-NTH-SOIL CTRL-NTH SEN-STH-TEMP SEN-STH-SOIL CTRL-STH &>simulator.log &
	@echo "Log: backend/simulator.log  |  tail -f simulator.log"

help:
	@echo "Available commands:"
	@echo "  make run         - Start the server"
	@echo "  make docker-up   - Start infra (PostgreSQL, InfluxDB, Redis, EMQX)"
	@echo "  make docker-down - Stop all dependencies"
	@echo "  make docker-logs - View dependency logs"
	@echo "  make migrate-up  - Run database migrations"
	@echo "  make test        - Run tests"
	@echo "  make tidy        - Tidy go modules"
	@echo "  make seed        - Seed test data (account, 2 fields, 6 devices, 2 zones)"
	@echo "  make simulate    - Run controller simulators (responds to irrigation commands)"
	@echo "  make simulate-all- Run all simulators (sensors + controllers, sends telemetry)"
