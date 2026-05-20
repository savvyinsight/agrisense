.PHONY: dev dev-backend dev-frontend build build-frontend build-backend \
        docker-up docker-down logs migrate test test-backend test-frontend lint frontend-lint \
        backend-lint tidy deploy deploy-check help

# ─── Development ─────────────────────────────────────────────────────────

dev: dev-backend dev-frontend       ## Start both backend and frontend

dev-backend:                        ## Start Go backend server
	cd backend && go run ./cmd/agrisense/

dev-frontend:                       ## Start Vite frontend dev server
	cd frontend && npm run dev

# ─── Build ────────────────────────────────────────────────────────────────

build: build-backend build-frontend ## Build both backend and frontend

build-backend:                      ## Build Go binary
	cd backend && go build -o bin/agrisense cmd/agrisense/main.go

build-frontend:                     ## Build frontend for production
	cd frontend && npm run build

# ─── Infrastructure (Docker) ──────────────────────────────────────────────

docker-up:                                 ## Start all Docker dependencies
	cd backend && make docker-up

docker-down:                               ## Stop all Docker dependencies
	cd backend && make docker-down

logs:                               ## View Docker logs
	cd backend && make docker-logs

migrate:                            ## Run database migrations
	cd backend && make migrate-up

migrate-down:                       ## Rollback last migration
	cd backend && make migrate-down

migrate-version:                    ## Show current migration version
	cd backend && make migrate-version

migrate-create:                     ## Create new migration (requires migrate CLI)
	cd backend && make migrate-create

# ─── Testing ──────────────────────────────────────────────────────────────

test: test-backend test-frontend    ## Run all tests

test-backend:                       ## Run Go tests
	cd backend && go test ./... -v

test-frontend:                      ## Run frontend tests
	cd frontend && npm test

# ─── Linting ──────────────────────────────────────────────────────────────

lint: backend-lint frontend-lint    ## Lint both backend and frontend

backend-lint:                       ## Run golangci-lint
	cd backend && golangci-lint run ./... 2>/dev/null || echo "golangci-lint not configured"

frontend-lint:                      ## Run ESLint
	cd frontend && npm run lint

# ─── Deployment ────────────────────────────────────────────────────────────

deploy-check:                          ## Verify production environment
	@echo "Checking prerequisites..."
	@command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is required"; exit 1; }
	@test -f .env || { echo "ERROR: .env file not found (copy .env.prod.example to .env)"; exit 1; }
	@echo "✓ docker found"
	@echo "✓ .env file found"
	@echo "All checks passed."

deploy: deploy-check                   ## Build and deploy to production
	docker compose -f docker-compose.prod.yml build --pull
	docker compose -f docker-compose.prod.yml up -d --remove-orphans
	@echo "Deployment complete. Check status with: docker compose -f docker-compose.prod.yml ps"

deploy-logs:                           ## View production logs
	docker compose -f docker-compose.prod.yml logs -f

deploy-down:                           ## Stop production services
	docker compose -f docker-compose.prod.yml down

deploy-ps:                             ## Show production service status
	docker compose -f docker-compose.prod.yml ps

# ─── Utilities ────────────────────────────────────────────────────────────

tidy:                               ## Tidy Go modules
	cd backend && go mod tidy

help:                               ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
