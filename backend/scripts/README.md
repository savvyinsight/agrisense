# Test Scripts

Two tools for setting up and running realistic device simulations:

## Quick start

```bash
make seed         # populate DB: account, 2 fields, 6 devices, 2 zones
make simulate-all # start all 6 device simulators (sensors + controllers)
tail -f simulator.log
```

Login at http://localhost:5173 with `test@agrisense.io` / `test123`.

---

## 1. Seed — `scripts/seed-test-data/`

Go program that connects directly to PostgreSQL and creates test records.
Idempotent: re-running skips existing records (matched by email / field name / device_id / zone name).

### What it creates

| Resource | Count | Details |
|----------|-------|---------|
| Account | 1 | "Test Farm" (professional tier, 10 users, 50 devices) |
| User | 1 | test@agrisense.io / account_owner |
| Fields | 2 | North Field (Corn, 12.5ha), South Field (Wheat, 8.3ha) |
| Sensors | 4 | SEN-NTH-TEMP, SEN-NTH-SOIL, SEN-STH-TEMP, SEN-STH-SOIL |
| Controllers | 2 | CTRL-NTH, CTRL-STH |
| Irrigation zones | 2 | Linked to respective controllers |

Field geometry is a ~1km² polygon around the lat/lng centroid. Devices are pre-linked to their field.

---

## 2. Simulator — `scripts/generate-device-simulator/`

Go MQTT client that mimics real agricultural IoT devices.
Accepts device IDs as CLI args; defaults to the seed script's IDs.

```bash
go run ./scripts/generate-device-simulator/ CTRL-NTH CTRL-STH            # controllers only
go run ./scripts/generate-device-simulator/ SEN-NTH-TEMP CTRL-NTH ...    # any combo
```

### Telemetry specification (published every 10s)

| Reading | Source | Behavior |
|---------|--------|----------|
| `temperature` | all devices | Diurnal sine wave. Peak ~base+8°C at 14:00, trough ~base-8°C at 04:00. Base is 22–26°C random per device. ±1.5°C noise. Clamped ≥5°C. |
| `humidity` | all devices | Inversely correlated with temperature. 85% at base temp, -1.5% per °C above base. ±5% noise. Clamped 30–95%. |
| `soil_moisture` | all devices | **Normal**: decays 0.3% per tick (1.8%/min). **Irrigating**: ramps to 80% over 2 min, holds for 30 min, then declines 0.2%/min. Clamped 0–85%. |
| `light_intensity` | all devices | Gaussian bell curve centered on 12:00, σ=2h. Peak ~100,000 lux at noon. Zero outside 06:00–18:00. ±5k lux noise. |

### Heartbeat specification (published every 30s)

| Field | Behavior |
|-------|----------|
| `rssi` | Random −50 to −75 dBm |
| `battery` | Starts at 95%, decays 5% per simulated day. Floor at 15%. |

### Command handling (controllers only)

Controllers subscribe to `device/{id}/commands`. When a command arrives:

| Command | Simulator action | Response |
|---------|------------------|----------|
| `irrigation_start` | Sets `irrigating=true`, starts moisture ramp | `{"status":"executed"}` |
| `irrigation_stop` | Sets `irrigating=false`, moisture decays normally | `{"status":"executed"}` |
| `irrigation_retry` | Same as `irrigation_start` | `{"status":"executed"}` |

Response is published to `device/{id}/response`. The backend's `HandleCommandResponse` updates the command record to `delivered` + `executed_at`.

### Moisture timeline example

```
t=0min    moisture=35%   idle, decaying 1.8%/min
t=+3min   moisture=29.6%  idle
          → Start button clicked ←
t=+3.1min  moisture=40%   irrigating, ramping up
t=+5min   moisture=80%   irrigating, holding
t=+33min  moisture=80%   irrigating, holding ends
          → Stop button clicked ←
t=+33.1min moisture=80%  idle, decaying from 80%
t=+36min  moisture=74.6%  idle
```

---

## End-to-end irrigation test

```bash
# 1. infra up
docker-compose up -d

# 2. backend + frontend (separate terminals)
cd backend && go run ./cmd/agrisense/
cd frontend && npm run dev

# 3. seed data (first time only)
cd backend && make seed

# 4. start simulators
cd backend && make simulate-all
# or just controllers: make simulate

# 5. open browser → http://localhost:5173
#    login: test@agrisense.io / test123

# 6. navigate to Fields → North Field
#    zone "North Field Zone" shows as idle
#    Click "Start" → simulator receives command, starts irrigation
#    Watch: tail -f simulator.log

# 7. After 2 minutes moisture hits 80% in the UI
#    Click "Stop" → simulator stops, moisture begins decaying

# 8. Check irrigation history in the zone card or Irrigation page
```

---

## Known device IDs

| Device ID | Type | Field | Purpose |
|-----------|------|-------|---------|
| `SEN-NTH-TEMP` | sensor | North Field | Temperature + humidity |
| `SEN-NTH-SOIL` | sensor | North Field | Soil moisture + light |
| `CTRL-NTH` | controller | North Field | Irrigation control |
| `SEN-STH-TEMP` | sensor | South Field | Temperature + humidity |
| `SEN-STH-SOIL` | sensor | South Field | Soil moisture + light |
| `CTRL-STH` | controller | South Field | Irrigation control |
