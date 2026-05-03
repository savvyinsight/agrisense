package integration

import (
	"testing"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/config"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/savvyinsight/agrisenseiot/internal/repository/influxdb"
	"github.com/savvyinsight/agrisenseiot/internal/repository/postgres"
	"github.com/savvyinsight/agrisenseiot/internal/repository/redis"
	"github.com/savvyinsight/agrisenseiot/internal/ruleengine"
	"github.com/savvyinsight/agrisenseiot/internal/service/data"
)

func TestDataPipeline(t *testing.T) {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Setup PostgreSQL connection
	pgConfig := postgres.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		DBName:   cfg.DBName,
		SSLMode:  cfg.DBSSLMode,
	}
	pgDB, err := postgres.NewConnection(pgConfig)
	if err != nil {
		t.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pgDB.Close()

	// Setup Redis connection
	redisConfig := redis.Config{
		Host:     cfg.RedisHost,
		Port:     cfg.RedisPort,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	}
	redisClient, err := redis.NewConnection(redisConfig)
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Setup InfluxDB connection
	influxConfig := influxdb.Config{
		URL:    cfg.InfluxURL,
		Token:  cfg.InfluxToken,
		Org:    cfg.InfluxOrg,
		Bucket: cfg.InfluxBucket,
	}
	influxRepo, err := influxdb.NewRepository(influxConfig)
	if err != nil {
		t.Fatalf("Failed to connect to InfluxDB: %v", err)
	}
	defer influxRepo.Close()

	// Create repositories
	deviceRepo := &postgres.DeviceRepository{DB: pgDB}
	sensorTypeRepo := &postgres.SensorTypeRepository{DB: pgDB}
	cacheRepo := redis.NewCacheRepository(redisClient)

	// Create rule engine
	ruleEngine := ruleengine.NewEngine(
		&postgres.AlertRuleRepository{DB: pgDB},
		&postgres.AlertRepository{DB: pgDB},
		&postgres.DeviceRepository{DB: pgDB},
	)
	ruleEngine.Start()
	defer ruleEngine.Stop()

	// Create data service with correct repositories
	dataService := data.NewService(
		sensorTypeRepo, // This implements SensorTypeRepository
		deviceRepo,     // This now implements all DeviceRepository methods
		cacheRepo,      // This implements CacheRepository
		influxRepo,     // This implements InfluxRepository
		ruleEngine,
	)
	// Ensure test device exists
	existing, _ := deviceRepo.GetByDeviceID("test-device-001")
	if existing == nil {
		testDevice := &domain.Device{
			DeviceID: "test-device-001",
			Name:     "Test Device",
			Type:     domain.DeviceTypeSensor,
			Status:   domain.DeviceStatusOnline,
			UserID:   1,
		}
		err = deviceRepo.Create(testDevice)
		if err != nil {
			t.Fatal(err)
		}
	}

	// Test data processing
	testPayload := []byte(`{
        "timestamp": "2024-03-08T12:00:00Z",
        "readings": [
            {"sensor": "temperature", "value": 23.5},
            {"sensor": "humidity", "value": 65.2}
        ]
    }`)

	err = dataService.ProcessTelemetry("test-device-001", testPayload)
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
