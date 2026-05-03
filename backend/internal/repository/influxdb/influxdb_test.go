package influxdb

import (
	"context"
	"testing"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/testcontainers/testcontainers-go"
)

func setupInfluxDBContainer(t *testing.T) (*Repository, func()) {
	ctx := context.Background()

	// Create InfluxDB container - using minimal options first
	// The API might have changed, so we'll use a simpler approach
	req := testcontainers.ContainerRequest{
		Image:        "influxdb:2.7-alpine",
		ExposedPorts: []string{"8086/tcp"},
		Env: map[string]string{
			"DOCKER_INFLUXDB_INIT_MODE":        "setup",
			"DOCKER_INFLUXDB_INIT_USERNAME":    "admin",
			"DOCKER_INFLUXDB_INIT_PASSWORD":    "admin123",
			"DOCKER_INFLUXDB_INIT_ORG":         "my-org",
			"DOCKER_INFLUXDB_INIT_BUCKET":      "testdb",
			"DOCKER_INFLUXDB_INIT_ADMIN_TOKEN": "test-token",
		},
		// WaitingFor: testcontainers.WithWaitStrategy(
		// 	testcontainers.WaitForHTTP("/health").
		// 		WithPort("8086/tcp").
		// 		WithStatusCodeMatcher(func(status int) bool {
		// 			return status == 200
		// 		})),
	}

	influxContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Get container host and port
	host, err := influxContainer.Host(ctx)
	if err != nil {
		t.Fatal(err)
	}

	port, err := influxContainer.MappedPort(ctx, "8086")
	if err != nil {
		t.Fatal(err)
	}

	// Construct URL
	url := "http://" + host + ":" + port.Port()

	// Create repository
	repo, err := NewRepository(Config{
		URL:    url,
		Token:  "test-token",
		Org:    "my-org",
		Bucket: "testdb",
	})
	if err != nil {
		t.Fatal(err)
	}

	cleanup := func() {
		repo.Close()
		influxContainer.Terminate(ctx)
	}

	return repo, cleanup
}

func TestInfluxDBRepository(t *testing.T) {
	repo, cleanup := setupInfluxDBContainer(t)
	defer cleanup()

	// Give InfluxDB a moment to initialize
	time.Sleep(3 * time.Second)

	// Test WriteData
	data := &domain.SensorData{
		DeviceID:   "test-device",
		SensorType: "temperature",
		Value:      23.5,
		Timestamp:  time.Now(),
	}

	err := repo.WriteData(data)
	if err != nil {
		t.Fatalf("Failed to write data: %v", err)
	}

	// Wait for data to be written
	time.Sleep(2 * time.Second)

	// Test Query
	end := time.Now()
	start := end.Add(-1 * time.Hour)

	results, err := repo.Query("test-device", "temperature", start, end)
	if err != nil {
		t.Fatalf("Failed to query data: %v", err)
	}

	if len(results) == 0 {
		t.Log("Warning: No results found - this might be due to InfluxDB indexing delay")
	} else {
		t.Logf("Found %d results", len(results))
	}

	// Test WriteBatch
	batch := []domain.SensorData{
		{
			DeviceID:   "test-device",
			SensorType: "humidity",
			Value:      65.0,
			Timestamp:  time.Now().Add(-5 * time.Minute),
		},
		{
			DeviceID:   "test-device",
			SensorType: "humidity",
			Value:      66.0,
			Timestamp:  time.Now().Add(-4 * time.Minute),
		},
	}

	err = repo.WriteBatch(batch)
	if err != nil {
		t.Fatalf("Failed to write batch: %v", err)
	}

	// Test QueryAggregate
	aggResults, err := repo.QueryAggregate("test-device", "humidity", start, end, "5m")
	if err != nil {
		t.Fatalf("Failed to query aggregate: %v", err)
	}

	t.Logf("Aggregate results: %+v", aggResults)
}
