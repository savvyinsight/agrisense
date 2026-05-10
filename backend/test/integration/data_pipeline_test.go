//go:build integration

package integration

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/infra/redis"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/user"
)

func TestDataPipeline(t *testing.T) {
	// Use shared test containers from setup_test.go
	// testDB, testRedis, testInflux are already initialized

	// Create repositories using test containers
	deviceRepo := &device.PostgresDeviceRepository{DB: testDB}
	sensorTypeRepo := &sensor.PostgresSensorTypeRepository{DB: testDB}
	cacheRepo := redis.NewCacheRepository(testRedis)
	userRepo := &user.PostgresUserRepository{DB: testDB}

	// Create InfluxDB repository
	influxConfig := sensor.Config{
		URL:    testInfluxURL,
		Token:  testInfluxToken,
		Org:    "test-org",
		Bucket: "test-bucket",
	}
	influxRepo, err := sensor.NewRepository(influxConfig)
	if err != nil {
		t.Fatalf("Failed to create InfluxDB repository: %v", err)
	}
	defer influxRepo.Close()

	// Create rule engine
	ruleEngine := ruleengine.NewEngine(
		&alert.PostgresAlertRuleRepository{DB: testDB},
		&alert.PostgresAlertRepository{DB: testDB},
		deviceRepo,
	)
	if err := ruleEngine.Start(); err != nil {
		t.Fatalf("Failed to start rule engine: %v", err)
	}
	defer ruleEngine.Stop()

	// Create data service
	dataService := data.NewService(
		sensorTypeRepo,
		deviceRepo,
		cacheRepo,
		influxRepo,
		ruleEngine,
	)

	// Ensure test user exists
	testUser := &user.User{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpass",
		Role:     "viewer",
	}
	err = userRepo.Create(testUser)
	if err != nil && !strings.Contains(err.Error(), "duplicate") { // Ignore if already exists
		t.Fatal(err)
	}
	// Get the user to ensure we have the ID
	existingUser, err := userRepo.GetByEmail("test@example.com")
	if err != nil {
		t.Fatal(err)
	}

	// Ensure test device exists
	existing, _ := deviceRepo.GetByDeviceID("test-device-001")
	if existing == nil {
		testDevice := &device.Device{
			DeviceID: "test-device-001",
			Name:     "Test Device",
			Type:     device.DeviceTypeSensor,
			Status:   device.DeviceStatusOnline,
			UserID:   existingUser.ID,
		}
		err = deviceRepo.Create(testDevice)
		if err != nil {
			t.Fatal(err)
		}
	}

	// Test data processing
	testPayload := fmt.Sprintf(`{
        "timestamp": "%s",
        "readings": [
            {"sensor": "temperature", "value": 23.5},
            {"sensor": "humidity", "value": 65.2}
        ]
    }`, time.Now().Format(time.RFC3339))

	err = dataService.ProcessTelemetry("test-device-001", []byte(testPayload))
	if err != nil {
		t.Errorf("Failed to process telemetry: %v", err)
	}

	// Wait for async writes
	time.Sleep(2 * time.Second)

	// Verify data in Redis
	temp, err := dataService.GetLatestReading("test-device-001", "temperature")
	if err != nil {
		t.Errorf("Failed to get latest reading: %v", err)
	}
	if temp.Value != 23.5 {
		t.Errorf("Expected 23.5, got %f", temp.Value)
	}
}
