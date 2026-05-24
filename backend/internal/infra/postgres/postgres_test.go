package postgres

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/control"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/user"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func setupPostgresContainer(t *testing.T) (*sql.DB, func()) {
	ctx := context.Background()

	// Create PostgreSQL container
	pgContainer, err := postgres.Run(ctx,
		"postgres:15-alpine",
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("testuser"),
		postgres.WithPassword("testpass"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(30*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}

	// Get connection string
	connStr, err := pgContainer.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}

	// Connect to database
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatal(err)
	}

	// Run migrations
	migrations := `
    CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'viewer',
        account_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE devices (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20),
        location VARCHAR(255),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        status VARCHAR(20) DEFAULT 'offline',
        last_heartbeat TIMESTAMP,
        firmware_version VARCHAR(20),
        config JSONB DEFAULT '{}',
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER,
        field_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE sensor_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        unit VARCHAR(20),
        min_value FLOAT,
        max_value FLOAT,
        icon VARCHAR(50)
    );

    INSERT INTO sensor_types (name, unit, min_value, max_value, icon) VALUES
    ('temperature', '°C', -40, 80, 'thermometer'),
    ('humidity', '%', 0, 100, 'droplet'),
    ('soil_moisture', '%', 0, 100, 'sprout'),
    ('light_intensity', 'lux', 0, 100000, 'sun');

    CREATE TABLE alert_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        sensor_type_id INTEGER REFERENCES sensor_types(id),
        condition VARCHAR(10),
        threshold_value FLOAT,
        threshold_max FLOAT,
        duration_seconds INTEGER DEFAULT 0,
        severity VARCHAR(20),
        enabled BOOLEAN DEFAULT TRUE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        account_id INTEGER,
        field_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER REFERENCES alert_rules(id),
        device_id INTEGER REFERENCES devices(id),
        sensor_value FLOAT NOT NULL,
        message VARCHAR(255) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'triggered',
        account_id INTEGER,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        metadata JSONB
    );

    CREATE TABLE control_commands (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id),
        command VARCHAR(50) NOT NULL,
        parameters JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        account_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        executed_at TIMESTAMP,
        user_id INTEGER REFERENCES users(id),
        metadata JSONB
    );
    `

	_, err = db.Exec(migrations)
	if err != nil {
		t.Fatal(err)
	}

	cleanup := func() {
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
		if err := pgContainer.Terminate(ctx); err != nil {
			t.Fatal(err)
		}
	}

	return db, cleanup
}

func TestUserRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	repo := &user.PostgresUserRepository{DB: db}

	// Create
	user := &user.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
		Role:     "viewer",
	}

	err := repo.Create(user)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}
	if user.ID == 0 {
		t.Fatal("Expected user ID to be set")
	}

	// GetByID
	found, err := repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("Failed to get user by ID: %v", err)
	}
	if found.Username != user.Username {
		t.Errorf("Expected username %s, got %s", user.Username, found.Username)
	}

	// GetByEmail
	found, err = repo.GetByEmail(user.Email)
	if err != nil {
		t.Fatalf("Failed to get user by email: %v", err)
	}
	if found.Email != user.Email {
		t.Errorf("Expected email %s, got %s", user.Email, found.Email)
	}

	// Update
	user.Username = "updateduser"
	err = repo.Update(user)
	if err != nil {
		t.Fatalf("Failed to update user: %v", err)
	}

	found, err = repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("Failed to get updated user: %v", err)
	}
	if found.Username != "updateduser" {
		t.Errorf("Expected username updateduser, got %s", found.Username)
	}

	// List
	users, total, err := repo.List(10, 0)
	if err != nil {
		t.Fatalf("Failed to list users: %v", err)
	}
	if total < 1 {
		t.Errorf("Expected at least 1 user, got %d", total)
	}
	if len(users) == 0 {
		t.Error("Expected at least one user in list")
	}

	// Delete
	err = repo.Delete(user.ID)
	if err != nil {
		t.Fatalf("Failed to delete user: %v", err)
	}

	_, err = repo.GetByID(user.ID)
	if err == nil {
		t.Error("Expected error when getting deleted user, got nil")
	}
}

func TestDeviceRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	// First create a user for device ownership
	userRepo := &user.PostgresUserRepository{DB: db}
	user := &user.User{
		Username: "deviceowner",
		Email:    "owner@example.com",
		Password: "hashed",
		Role:     "admin",
	}
	err := userRepo.Create(user)
	if err != nil {
		t.Fatal(err)
	}

	repo := &device.PostgresDeviceRepository{DB: db}

	// Create
	location := "Test Location"
	lat := 12.3456
	lon := 65.4321
	dev := &device.Device{
		DeviceID:        "test-device-001",
		Name:            "Test Device",
		Type:            device.DeviceTypeSensor,
		Location:        &location,
		Latitude:        &lat,
		Longitude:       &lon,
		Status:          device.DeviceStatusOffline,
		FirmwareVersion: ptrString("1.0.0"),
		Config:          map[string]interface{}{"interval": 30},
		UserID:          &user.ID,
	}

	err = repo.Create(dev)
	if err != nil {
		t.Fatalf("Failed to create device: %v", err)
	}
	if dev.ID == 0 {
		t.Fatal("Expected device ID to be set")
	}

	// GetByID
	found, err := repo.GetByID(dev.ID)
	if err != nil {
		t.Fatalf("Failed to get device by ID: %v", err)
	}
	if found.DeviceID != dev.DeviceID {
		t.Errorf("Expected DeviceID %s, got %s", dev.DeviceID, found.DeviceID)
	}
	if found.Location == nil || *found.Location != location {
		t.Errorf("Expected Location %s, got %v", location, found.Location)
	}
	if found.Latitude == nil || *found.Latitude != lat {
		t.Errorf("Expected Latitude %v, got %v", lat, found.Latitude)
	}
	if found.Longitude == nil || *found.Longitude != lon {
		t.Errorf("Expected Longitude %v, got %v", lon, found.Longitude)
	}
	if found.FirmwareVersion == nil || *found.FirmwareVersion != "1.0.0" {
		t.Errorf("Expected FirmwareVersion 1.0.0, got %v", found.FirmwareVersion)
	}
	if found.Config == nil || found.Config["interval"] != float64(30) {
		t.Errorf("Expected Config interval 30, got %v", found.Config)
	}

	// GetByDeviceID
	found, err = repo.GetByDeviceID(dev.DeviceID)
	if err != nil {
		t.Fatalf("Failed to get device by DeviceID: %v", err)
	}
	if found.Name != dev.Name {
		t.Errorf("Expected Name %s, got %s", dev.Name, found.Name)
	}

	// Update
	dev.Name = "Updated Device"
	updatedLat := 98.7654
	updatedLon := 54.321
	dev.Latitude = &updatedLat
	dev.Longitude = &updatedLon
	dev.FirmwareVersion = ptrString("1.0.1")
	dev.Config = map[string]interface{}{"interval": 60}
	err = repo.Update(dev)
	if err != nil {
		t.Fatalf("Failed to update device: %v", err)
	}

	updated, err := repo.GetByID(dev.ID)
	if err != nil {
		t.Fatalf("Failed to get updated device by ID: %v", err)
	}
	if updated.Name != "Updated Device" {
		t.Errorf("Expected updated name, got %s", updated.Name)
	}
	if updated.Latitude == nil || *updated.Latitude != updatedLat {
		t.Errorf("Expected updated latitude %v, got %v", updatedLat, updated.Latitude)
	}
	if updated.Longitude == nil || *updated.Longitude != updatedLon {
		t.Errorf("Expected updated longitude %v, got %v", updatedLon, updated.Longitude)
	}
	if updated.FirmwareVersion == nil || *updated.FirmwareVersion != "1.0.1" {
		t.Errorf("Expected updated firmware 1.0.1, got %v", updated.FirmwareVersion)
	}
	if updated.Config == nil || updated.Config["interval"] != float64(60) {
		t.Errorf("Expected updated config interval 60, got %v", updated.Config)
	}

	// UpdateHeartbeat
	err = repo.UpdateHeartbeat(dev.DeviceID)
	if err != nil {
		t.Fatalf("Failed to update heartbeat: %v", err)
	}

	// UpdateStatus
	err = repo.UpdateStatus(dev.DeviceID, "online")
	if err != nil {
		t.Fatalf("Failed to update status: %v", err)
	}

	// GetByUserID
	devices, err := repo.GetByUserID(user.ID)
	if err != nil {
		t.Fatalf("Failed to get devices by user ID: %v", err)
	}
	if len(devices) == 0 {
		t.Error("Expected at least one device")
	}

	// List
	listed, total, err := repo.List(0, user.ID, device.DeviceFilter{}, 10, 0)
	if err != nil {
		t.Fatalf("Failed to list devices: %v", err)
	}
	if total < 1 {
		t.Errorf("Expected at least 1 device, got %d", total)
	}
	if len(listed) == 0 {
		t.Error("Expected at least one device in list")
	}

	// Delete
	err = repo.Delete(dev.ID, 0)
	if err != nil {
		t.Fatalf("Failed to delete device: %v", err)
	}

	_, err = repo.GetByID(dev.ID)
	if err == nil {
		t.Error("Expected error when getting deleted device, got nil")
	}
}

func TestAlertRuleRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	// Create user and device
	userRepo := &user.PostgresUserRepository{DB: db}
	user := &user.User{
		Username: "alertuser",
		Email:    "alert@example.com",
		Password: "hashed",
		Role:     "admin",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	deviceRepo := &device.PostgresDeviceRepository{DB: db}
	device := &device.Device{
		DeviceID: "alert-device",
		Name:     "Alert Device",
		Type:     device.DeviceTypeSensor,
		UserID:   &user.ID,
	}
	if err := deviceRepo.Create(device); err != nil {
		t.Fatalf("Failed to create device: %v", err)
	}

	repo := &alert.PostgresAlertRuleRepository{DB: db}

	// Create
	rule := &alert.AlertRule{
		Name:            "Test Alert",
		DeviceID:        &device.ID,
		SensorTypeID:    1, // temperature
		Condition:       alert.ConditionGT,
		ThresholdValue:  ptrFloat64(30.0),
		DurationSeconds: 60,
		Severity:        alert.SeverityWarning,
		Enabled:         true,
		UserID:          user.ID,
	}

	err := repo.Create(rule)
	if err != nil {
		t.Fatalf("Failed to create alert rule: %v", err)
	}
	if rule.ID == 0 {
		t.Fatal("Expected rule ID to be set")
	}

	// GetByID
	found, err := repo.GetByID(rule.ID)
	if err != nil {
		t.Fatalf("Failed to get rule by ID: %v", err)
	}
	if found.Name != rule.Name {
		t.Errorf("Expected name %s, got %s", rule.Name, found.Name)
	}

	// GetByDeviceID
	rules, err := repo.GetByDeviceID(device.ID, 0)
	if err != nil {
		t.Fatalf("Failed to get rules by device ID: %v", err)
	}
	if len(rules) == 0 {
		t.Error("Expected at least one rule")
	}

	// GetEnabledRules
	enabled, err := repo.GetEnabledRules(0)
	if err != nil {
		t.Fatalf("Failed to get enabled rules: %v", err)
	}
	if len(enabled) == 0 {
		t.Error("Expected at least one enabled rule")
	}

	// Update
	rule.Name = "Updated Rule"
	rule.Enabled = false
	err = repo.Update(rule)
	if err != nil {
		t.Fatalf("Failed to update rule: %v", err)
	}

	// List
	listed, err := repo.List(0, user.ID)
	if err != nil {
		t.Fatalf("Failed to list rules: %v", err)
	}
	if len(listed) == 0 {
		t.Error("Expected at least one rule in list")
	}

	// Delete
	err = repo.Delete(rule.ID, 0)
	if err != nil {
		t.Fatalf("Failed to delete rule: %v", err)
	}

	_, err = repo.GetByID(rule.ID)
	if err == nil {
		t.Error("Expected error when getting deleted rule, got nil")
	}
}

func ptrString(s string) *string {
	return &s
}

func ptrFloat64(f float64) *float64 {
	return &f
}

func TestAlertRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	// Create user, device, and rule
	userRepo := &user.PostgresUserRepository{DB: db}
	user := &user.User{
		Username: "historyuser",
		Email:    "history@example.com",
		Password: "hashed",
		Role:     "admin",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	deviceRepo := &device.PostgresDeviceRepository{DB: db}
	device := &device.Device{
		DeviceID: "history-device",
		Name:     "History Device",
		Type:     device.DeviceTypeSensor,
		UserID:   &user.ID,
	}
	if err := deviceRepo.Create(device); err != nil {
		t.Fatalf("Failed to create device: %v", err)
	}

	ruleRepo := &alert.PostgresAlertRuleRepository{DB: db}
	rule := &alert.AlertRule{
		Name:           "History Rule",
		DeviceID:       &device.ID,
		SensorTypeID:   1,
		Condition:      alert.ConditionGT,
		ThresholdValue: ptrFloat64(30.0),
		Severity:       alert.SeverityWarning,
		Enabled:        true,
		UserID:          user.ID,
	}
	if err := ruleRepo.Create(rule); err != nil {
		t.Fatalf("Failed to create rule: %v", err)
	}

	repo := &alert.PostgresAlertRepository{DB: db}

	// Create
	alert := &alert.Alert{
		RuleID:      rule.ID,
		DeviceID:    device.ID,
		SensorValue: 35.5,
		Message:     "Temperature too high",
		Severity:    alert.SeverityWarning,
		Status:      alert.AlertStatusTriggered,
		TriggeredAt: time.Now(),
		Metadata:    map[string]interface{}{"test": true},
	}

	err := repo.Create(alert)
	if err != nil {
		t.Fatalf("Failed to create alert: %v", err)
	}
	if alert.ID == 0 {
		t.Fatal("Expected alert ID to be set")
	}

	// GetActive
	active, err := repo.GetActive(0)
	if err != nil {
		t.Fatalf("Failed to get active alerts: %v", err)
	}
	if len(active) == 0 {
		t.Error("Expected at least one active alert")
	}

	// GetByDeviceID
	deviceAlerts, err := repo.GetByDeviceID(device.ID, 0)
	if err != nil {
		t.Fatalf("Failed to get alerts by device ID: %v", err)
	}
	if len(deviceAlerts) == 0 {
		t.Error("Expected at least one alert for device")
	}

	// GetByRuleID
	ruleAlerts, err := repo.GetByRuleID(rule.ID)
	if err != nil {
		t.Fatalf("Failed to get alerts by rule ID: %v", err)
	}
	if len(ruleAlerts) == 0 {
		t.Error("Expected at least one alert for rule")
	}

	// Acknowledge
	err = repo.Acknowledge(alert.ID, 0)
	if err != nil {
		t.Fatalf("Failed to acknowledge alert: %v", err)
	}

	// Resolve
	err = repo.Resolve(alert.ID, 0)
	if err != nil {
		t.Fatalf("Failed to resolve alert: %v", err)
	}

	// List
	alerts, total, err := repo.List(0, 10, 0)
	if err != nil {
		t.Fatalf("Failed to list alerts: %v", err)
	}
	if total < 1 {
		t.Errorf("Expected at least 1 alert, got %d", total)
	}
	if len(alerts) == 0 {
		t.Error("Expected at least one alert in list")
	}
}

func TestCommandRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	// Create user and device
	userRepo := &user.PostgresUserRepository{DB: db}
	user := &user.User{
		Username: "cmduser",
		Email:    "cmd@example.com",
		Password: "hashed",
		Role:     "admin",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	deviceRepo := &device.PostgresDeviceRepository{DB: db}
	device := &device.Device{
		DeviceID: "cmd-device",
		Name:     "Command Device",
		Type:     device.DeviceTypeController,
		UserID:   &user.ID,
	}
	if err := deviceRepo.Create(device); err != nil {
		t.Fatalf("Failed to create device: %v", err)
	}

	repo := &control.PostgresCommandRepository{DB: db}

	// Create
	cmd := &control.Command{
		DeviceID:   device.ID,
		Command:    "turn_on",
		Parameters: map[string]interface{}{"duration": 30},
		Status:     control.CommandStatusPending,
		UserID:     &user.ID,
		Metadata:   map[string]interface{}{"source": "test"},
	}

	err := repo.Create(cmd)
	if err != nil {
		t.Fatalf("Failed to create command: %v", err)
	}
	if cmd.ID == 0 {
		t.Fatal("Expected command ID to be set")
	}

	// GetByID
	found, err := repo.GetByID(cmd.ID)
	if err != nil {
		t.Fatalf("Failed to get command by ID: %v", err)
	}
	if found.Command != cmd.Command {
		t.Errorf("Expected command %s, got %s", cmd.Command, found.Command)
	}

	// GetByDeviceID
	deviceCmds, err := repo.GetByDeviceID(device.ID, 10)
	if err != nil {
		t.Fatalf("Failed to get commands by device ID: %v", err)
	}
	if len(deviceCmds) == 0 {
		t.Error("Expected at least one command for device")
	}

	// GetPending
	pending, err := repo.GetPending(device.ID)
	if err != nil {
		t.Fatalf("Failed to get pending commands: %v", err)
	}
	if len(pending) == 0 {
		t.Error("Expected at least one pending command")
	}

	// UpdateStatus
	err = repo.UpdateStatus(cmd.ID, control.CommandStatusSent)
	if err != nil {
		t.Fatalf("Failed to update command status: %v", err)
	}

	// UpdateDelivery
	now := time.Now()
	err = repo.UpdateDelivery(cmd.ID, &now, &now, &now)
	if err != nil {
		t.Fatalf("Failed to update command delivery: %v", err)
	}

	// Verify final status
	updated, err := repo.GetByID(cmd.ID)
	if err != nil {
		t.Fatalf("Failed to get updated command: %v", err)
	}
	if updated.Status != control.CommandStatusExecuted {
		t.Errorf("Expected status %s, got %s", control.CommandStatusExecuted, updated.Status)
	}
}

func TestSensorTypeRepository(t *testing.T) {
	db, cleanup := setupPostgresContainer(t)
	defer cleanup()

	repo := &sensor.PostgresSensorTypeRepository{DB: db}

	// Test GetSensorTypes
	types, err := repo.GetSensorTypes()
	if err != nil {
		t.Fatalf("Failed to get sensor types: %v", err)
	}
	if len(types) == 0 {
		t.Error("Expected at least one sensor type")
	}

	// Test GetSensorTypeByID
	if len(types) > 0 {
		found, err := repo.GetSensorTypeByID(types[0].ID)
		if err != nil {
			t.Fatalf("Failed to get sensor type by ID: %v", err)
		}
		if found.Name != types[0].Name {
			t.Errorf("Expected name %s, got %s", types[0].Name, found.Name)
		}
	}

	// Test GetSensorTypeByName
	temp, err := repo.GetSensorTypeByName("temperature")
	if err != nil {
		t.Fatalf("Failed to get sensor type by name: %v", err)
	}
	if temp.Unit != "°C" {
		t.Errorf("Expected unit °C, got %s", temp.Unit)
	}
}
