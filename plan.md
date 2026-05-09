# AgriSense Backend Refactoring Plan

## Problem Statement
The current backend uses a layered architecture (`internal/domain`, `internal/repository`, `internal/service`, `internal/handler`) with module path `github.com/savvyinsight/agrisenseiot`. This plan refactors it into a feature-based modular monolith with the correct module path `github.com/savvyinsight/agrisense`, moving incrementally with AI assistance and validation at each step.

## Approach
1. **Phase 1**: Update module path (go.mod) and fix all import references project-wide
2. **Phases 2-6**: Refactor features one at a time (`device` → `sensor` → `alert` → `user` → `automation`)
3. **Phase 7**: Extract remaining features (`analytics`, `control`, `command`)
4. **Phase 8**: Consolidate entry points (`cmd/server/main.go` + `cmd/mqtt-handler/main.go`)
5. Each phase: move files (git mv) → rewrite with AI → validate (go build) → commit

## Key Features to Extract
- **device**: device management (domain/repository/service/handler)
- **sensor**: sensor data handling (domain/repository/service/handler)
- **alert**: alerting system (domain/repository/service/handler)
- **user**: user management (domain/repository/service/handler)
- **automation**: automation rules (domain/repository/service/handler)
- **analytics**: analytics endpoints (handler only initially)
- **control**: control operations (handler only)
- **command**: device commands (domain/repository)

## Codebase Snapshot
- **Module path** (current): `github.com/savvyinsight/agrisenseiot`
- **Domain types**: 7 types (alert, analytics, automation, command, device, sensor, user)
- **Handlers**: 8 handler files (alert, analytics, automation, control, data, device, auth, websocket)
- **Repositories**: Multiple per storage backend (Postgres, Redis, InfluxDB)
- **Services**: Likely mirrored to domain types
- **Entry points**: `cmd/server/main.go` (REST/WebSocket), `cmd/mqtt-handler/main.go` (MQTT)
- **Files affected**: ~37 Go files with old import paths

## Execution Plan

### Phase 1: Module Path Update
- [ ] Update `go.mod`: `module github.com/savvyinsight/agrisense`
- [ ] Use `find + sed` or manual grep to identify all 37 files with old import paths
- [ ] Update all imports: `github.com/savvyinsight/agrisenseiot` → `github.com/savvyinsight/agrisense`
- [ ] Run `go mod tidy` and `go build ./...`
- [ ] Commit: "refactor: update module path to agrisense"

### Phase 2: Device Feature Refactoring
- [ ] Move files: `internal/domain/device.go` → `internal/device/domain.go`
- [ ] Move files: `internal/service/device_service.go` → `internal/device/service.go`
- [ ] Move files: `internal/repository/postgres/device_repo.go` → `internal/device/repository_postgres.go`
- [ ] Move files: `internal/handler/rest/device_handler.go` → `internal/device/handler.go`
- [ ] Generate external file list (files importing old device paths)
- [ ] Use AI refactoring prompt to rewrite all 4 device files + external files
- [ ] Apply changes, validate with `go build ./...`
- [ ] Commit: "refactor: extract device feature to internal/device"

### Phase 3: Sensor Feature Refactoring
- [ ] Move files: `internal/domain/sensor.go` → `internal/sensor/domain.go`
- [ ] Move files: `internal/service/sensor_service.go` → `internal/sensor/service.go`
- [ ] Move files: `internal/repository/postgres/sensor_type_repo.go` → `internal/sensor/repository.go` (combine types)
- [ ] Move files: `internal/repository/influxdb/sensor_repo.go` → `internal/sensor/repository_influxdb.go`
- [ ] Generate external file list
- [ ] Use AI refactoring prompt
- [ ] Validate and commit

### Phase 4: Alert Feature Refactoring
- [ ] Move domain, service, repository, handler files
- [ ] Includes: `alert.go`, `alert_service.go`, `alert_repo.go`, `alert_handler.go`, `alert_history_repo.go`
- [ ] Generate external file list
- [ ] Use AI refactoring prompt
- [ ] Validate and commit

### Phase 5: User Feature Refactoring
- [ ] Move: `internal/domain/user.go` → `internal/user/domain.go`
- [ ] Move: `internal/repository/postgres/user_repo.go` → `internal/user/repository.go`
- [ ] Note: May not have a dedicated service; review first
- [ ] Generate external file list
- [ ] Use AI refactoring prompt
- [ ] Validate and commit

### Phase 6: Automation Feature Refactoring
- [ ] Move: `internal/domain/automation.go` → `internal/automation/domain.go`
- [ ] Move: `internal/repository/postgres/automation_repo.go` → `internal/automation/repository.go`
- [ ] Move: `internal/handler/rest/automation_handler.go` → `internal/automation/handler.go`
- [ ] Generate external file list
- [ ] Use AI refactoring prompt
- [ ] Validate and commit

### Phase 7: Extract Remaining Features
#### Command Feature
- [ ] Move: `internal/domain/command.go` → `internal/command/domain.go`
- [ ] Move: `internal/repository/postgres/command_repo.go` → `internal/command/repository.go`
- [ ] Validate and commit

#### Analytics Feature
- [ ] Move: `internal/handler/rest/analytics_handler.go` → `internal/analytics/handler.go`
- [ ] Review for domain/repository dependencies
- [ ] Validate and commit

#### Control Feature
- [ ] Move: `internal/handler/rest/control_handler.go` → `internal/control/handler.go`
- [ ] Review for domain/repository dependencies
- [ ] Validate and commit

### Phase 8: Final Cleanup & Entry Points
- [ ] Delete empty `internal/domain/`, `internal/service/`, `internal/repository/` directories
- [ ] Update `internal/mqtt/` if needed for new import paths
- [ ] Update `internal/config/` if it imports old paths
- [ ] Review middleware and other shared code
- [ ] Plan: Consolidate `cmd/server/main.go` and `cmd/mqtt-handler/main.go` (separate pass)
- [ ] Run full test suite: `go test ./...`
- [ ] Final commit: "refactor: complete modular monolith conversion"

## Validation Steps (After Each Phase)
1. Run `go build ./...` — must compile with no errors
2. Run `go mod tidy` — clean up unused imports
3. Optionally run tests: `go test ./...` (if tests exist for the feature)
4. Review git diff for any missed imports

## AI Refactoring Prompt Template
Use this prompt for each feature. Customize the feature name and file list.

```
You are helping me refactor a Go project from a layered architecture 
(domain/service/repository/handler) into a feature-based modular monolith. 

I have already moved the following files using `git mv`:
- internal/domain/{FEATURE}.go → internal/{FEATURE}/domain.go
- internal/repository/.../{FEATURE}*.go → internal/{FEATURE}/repository*.go
- internal/service/{FEATURE}_service.go → internal/{FEATURE}/service.go
- internal/handler/rest/{FEATURE}_handler.go → internal/{FEATURE}/handler.go

The old package names were `domain`, `repository`, `service`, and `rest`. 
The new package name for all files must be `{FEATURE}`.

I need you to:
1. Rewrite the `package` declaration to `package {FEATURE}`
2. Remove imports from the old packages (now colocated in {FEATURE}/)
3. Update external files that import old packages
4. Keep all logic and comments exactly as-is

External files that need updates (from grep output):
[PASTE GREP OUTPUT HERE]

Output the complete new file content for each file.
Before starting, confirm you understand the task.
```

## Dependencies & Notes
- No complex service-to-service dependencies expected (modular monolith)
- MQTT handler likely depends on multiple features (leave for later)
- WebSocket hub may need special attention (cross-feature)
- Redis cache may be shared; consider `internal/cache/` if multiple features use it

## Success Criteria
- ✅ All 37+ files compiling after module path update
- ✅ Each feature isolated in its own `internal/{feature}/` directory
- ✅ Package names aligned with directory names
- ✅ All imports updated (no stale `agrisenseiot` or old paths)
- ✅ `go build ./...` and `go mod tidy` pass with no warnings
- ✅ Tests pass (if applicable)
- ✅ Each phase committed with clear commit message

## Timeline Notes
- Each phase: ~1–2 hours (depends on AI turnaround + manual validation)
- Total: ~8–16 hours across 8 phases
- Can parallelize some research/cleanup work between phases

---

## Ready to Execute?
Next step: Phase 1 — Update module path in `go.mod` and globally update imports. Proceed?