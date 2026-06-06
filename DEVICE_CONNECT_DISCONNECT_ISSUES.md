# Device Connect/Disconnect Logic Issues

## Overview

The device connect (online) path works correctly. The disconnect (offline) path has critical gaps — devices that disconnect are **never automatically marked offline**.

---

## Architecture

- **MQTT Broker:** EMQX
- **Backend:** Go + Paho MQTT client
- **State Store:** PostgreSQL (`devices` table: `status`, `last_heartbeat`)
- **Data Store:** InfluxDB (telemetry)

### Connect Flow (Working)

```
Device → MQTT Broker → Backend
  1. FindOrCreate(deviceID)       → auto-register in PostgreSQL
  2. UpdateStatus("online")      → set status = 'online'
  3. UpdateHeartbeat()           → set last_heartbeat = NOW()
```

Both `device/{id}/telemetry` (every 10s) and `device/{id}/heartbeat` (every 30s) trigger this flow.

### Disconnect Flow (Broken)

```
Device → ❌ (network loss / power failure)

  ❌ No LWT              → broker can't notify backend
  ❌ StatusManager       → never started, no periodic check
  ❌ connectionLostHandler → only logs, doesn't update device status

  Result: device.status remains "online" forever
```

---

## Issues

### 1. StatusManager is Dead Code [CRITICAL]

**File:** `backend/internal/mqtt/handlers/status_manager.go`

`StatusManager` is defined with a periodic loop that checks for stale heartbeats and marks devices offline. However, `NewStatusManager` is **never called anywhere** in the application.

- `run.go` does not instantiate or start it.
- The offline detection loop never runs.
- Devices that stop sending heartbeats are never marked offline.

**Fix:** Wire up `StatusManager` in `backend/cmd/agrisense/run.go`:
- Create it with `NewStatusManager(deviceRepo, 5*time.Minute, 1*time.Minute)`
- Call `Start()` after MQTT service starts
- Call `Stop()` during graceful shutdown

---

### 2. No MQTT Last Will and Testament (LWT) [MEDIUM]

**File:** `backend/internal/mqtt/client.go` (lines 29–62)

The MQTT client options do not call `opts.SetWill(...)`. There is zero LWT configuration in the codebase.

When a device's TCP connection drops ungracefully (power loss, network failure), the EMQX broker has no will message to publish. The platform gets no immediate notification.

**Fix:** This requires both sides:
- **Backend:** Configure LWT topic and payload on the server-side MQTT client (if the broker should publish a will on behalf of the server connection).
- **Device firmware:** Each device should connect with its own LWT (e.g., `device/{id}/status` with payload `{"status":"offline"}`), so the broker publishes it automatically on unexpected disconnect.
- **Backend handler:** Subscribe to `device/+/status` and handle the offline will message.

---

### 3. connectionLostHandler is Passive [LOW]

**File:** `backend/internal/mqtt/client.go` (lines 65–67)

```go
func connectionLostHandler(client mqtt.Client, err error) {
    log.Printf("MQTT connection lost: %v", err)
}
```

This fires only when the **backend's own MQTT client** loses its broker connection — not when a device disconnects. It logs the error but takes no action.

**Note:** This is architecturally correct (device disconnects are not broker-level events), but consider adding reconnection logic or alerting if the backend-broker link is unstable.

---

### 4. `active_devices_total` Metric Never Updated [LOW]

**File:** `backend/internal/middleware/metrics.go` (line 77)

`SetActiveDevices(count)` is defined but never called anywhere in the codebase.

**Fix:** Call it from `StatusManager` after each offline check, or add a separate metrics collector that queries device counts by status.

---

## Key Files

| File | Role |
|------|------|
| `backend/internal/mqtt/client.go` | MQTT client setup, connection options, subscriptions |
| `backend/internal/mqtt/service.go` | MQTT service orchestrator (start/stop) |
| `backend/internal/mqtt/topics.go` | Topic pattern definitions |
| `backend/internal/mqtt/handlers/heartbeat.go` | Heartbeat handler — marks online, updates last_heartbeat |
| `backend/internal/mqtt/handlers/telemetry.go` | Telemetry handler — also marks online, updates last_heartbeat |
| `backend/internal/mqtt/handlers/status_manager.go` | Periodic offline checker (**dead code**) |
| `backend/internal/device/domain.go` | Device domain model, status constants, repository interface |
| `backend/internal/device/repository_postgres.go` | PostgreSQL: UpdateStatus, UpdateHeartbeat, FindOrCreate, MarkOfflineByHeartbeat |
| `backend/cmd/agrisense/run.go` | Application bootstrap — where StatusManager should be wired up |
| `backend/internal/middleware/metrics.go` | Prometheus metrics (active_devices never updated) |

---

## Recommended Fix Order

1. **Wire up StatusManager** in `run.go` (fixes automatic offline detection)
2. **Add LWT to device firmware** + backend handler (fixes instant disconnect detection)
3. **Update `active_devices_total` metric** from StatusManager (observability)
