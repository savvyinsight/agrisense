.PHONY: run test docker-up docker-down migrate-up migrate-down migrate-force migrate-version migrate-create help seed simulate simulate-all

run:
	go run ./cmd/agrisense/

docker-up:
	docker rm -f agrisense-postgres agrisense-influxdb agrisense-redis agrisense-emqx agrisense-prometheus agrisense-grafana 2>/dev/null; true
	docker compose -f deployments/docker-compose.yml up -d

docker-down:
	docker compose -f deployments/docker-compose.yml down

docker-logs:
	docker compose -f deployments/docker-compose.yml logs -f

migrate-up:
	@echo "Running database migrations..."
	go run ./cmd/migrate/ up

migrate-down:
	@echo "Rolling back last migration..."
	go run ./cmd/migrate/ down $(filter-out $@,$(MAKECMDGOALS))

migrate-force:
	@echo "Forcing migration version..."
	go run ./cmd/migrate/ force $(filter-out $@,$(MAKECMDGOALS))

migrate-version:
	@echo "Checking migration version..."
	go run ./cmd/migrate/ version

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir migrations -seq $$name

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
	@echo "  make migrate-up    - Run all pending migrations"
	@echo "  make migrate-down  - Rollback last migration (or specify N: make migrate-down N)"
	@echo "  make migrate-force - Force migration version (dangerous): make migrate-force VERSION"
	@echo "  make migrate-version - Show current migration version"
	@echo "  make migrate-create - Create new migration (requires migrate CLI)"
	@echo "  make test        - Run tests"
	@echo "  make tidy        - Tidy go modules"
	@echo "  make seed        - Seed test data (account, 2 fields, 6 devices, 2 zones)"
	@echo "  make simulate    - Run controller simulators (responds to irrigation commands)"
	@echo "  make simulate-all- Run all simulators (sensors + controllers, sends telemetry)"
