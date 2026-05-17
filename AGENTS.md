# AGENTS.md — AgriSense

## Project structure
- `backend/` — Go 1.25.5 + Gin single-binary server (`cmd/agrisense/main.go`)
- `frontend/` — React 19 + TypeScript + Vite SPA (`src/main.tsx`)
- `backend/internal/` has 17 sub-packages — entrypoint wires all in `run.go`
- Root `docker-compose.yml` starts infra (PostgreSQL 15, InfluxDB 2.7, Redis 7, EMQX 5.3, Prometheus, Grafana)
- Not a workspace monorepo — each dir has own `package.json` / `go.mod` and `Makefile`

## Start order (matters)
1. `docker-compose up -d` or `make up` — infra containers
2. `cd backend && cp .env.example .env`
3. `make dev-backend` — runs `go run ./cmd/agrisense/`
4. `make dev-frontend` — runs `npm run dev` in `frontend/`

## Key commands
| Action | Command |
|--------|---------|
| Backend unit tests | `cd backend && go test ./... -v` |
| Backend integration tests | `cd backend && go test -tags=integration ./... -v` (needs Docker) |
| Frontend lint | `npm run lint` (in `frontend/`) |
| Frontend type-check | `npx tsc --noEmit` (in `frontend/`) |
| Frontend test | **placeholder only** — no framework configured |
| Backend lint | `golangci-lint run ./...` (in `backend/`) |
| Build backend binary | `go build -o bin/agrisense cmd/agrisense/main.go` |
| Migrations | `make migrate-up` — SQL files in `deployments/init/postgres/` (auto-run on container start) |
| Tidy Go modules | `make tidy` |
| Root Makefile wraps all above | `make dev`, `make test`, `make lint`, etc. |
| Device simulator (irrigation) | `cd backend && make simulate` — MQTT device that responds to irrigation commands |
| Device simulator (all) | `cd backend && make simulate-all` — sensors + controller MQTT simulators |

## Frontend quirks
- Vite proxies `/api` → `localhost:8080`, `/ws` → `ws://localhost:8080` (`vite.config.ts:14-25`)
- Path alias `@/` → `src/`
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Auth: token in `localStorage` key `"token"`, injected as `Bearer` by Axios interceptor (`src/api/client.ts`)
- Tech: MUI, Chart.js/Recharts, Leaflet, React Router v7, Zustand, i18next (en/zh)

## Backend quirks
- Config: `.env` file loaded by `godotenv`; `--config` flag supported via `urfave/cli`
- Single binary runs HTTP API + MQTT subscriber + WebSocket hub + rule engine + automation service (all in one process)
- Routes: `/api/v1/*` (JWT-protected), `/ws` (WebSocket), `/metrics` (Prometheus), `/health`
- CORS allows `localhost:5173` and production Vercel frontend URL
- Integration tests use testcontainers-go (Postgres + Redis + InfluxDB containers)

## Deployment
- Dockerfiles: `backend/deployments/docker/Dockerfile.api` and `Dockerfile.mqtt`
- Prod compose: `backend/deployments/docker-compose.prod.yml`
- nginx in `backend/deployments/nginx/`
