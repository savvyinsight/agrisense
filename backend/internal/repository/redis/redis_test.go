package redis

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/testcontainers/testcontainers-go/modules/redis"
)

func setupRedisContainer(t *testing.T) (*CacheRepository, func()) {
	ctx := context.Background()

	// Create Redis container using current API
	redisContainer, err := redis.Run(ctx,
		"redis:7-alpine",
	)
	if err != nil {
		t.Fatal(err)
	}

	// Get connection string
	connectionString, err := redisContainer.ConnectionString(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Parse the connection string (format: redis://localhost:32794)
	// Remove the redis:// prefix
	addr := strings.TrimPrefix(connectionString, "redis://")

	// Split into host and port
	parts := strings.Split(addr, ":")
	if len(parts) != 2 {
		t.Fatalf("Unexpected address format: %s", addr)
	}

	host := parts[0]
	port := 0
	fmt.Sscanf(parts[1], "%d", &port)

	// Create Redis client
	client, err := NewConnection(Config{
		Host:     host,
		Port:     port,
		Password: "",
		DB:       0,
	})
	if err != nil {
		t.Fatal(err)
	}

	repo := NewCacheRepository(client)

	cleanup := func() {
		client.Close()
		redisContainer.Terminate(ctx)
	}

	return repo, cleanup
}

func TestCacheRepository(t *testing.T) {
	repo, cleanup := setupRedisContainer(t)
	defer cleanup()

	// Test SetJSON and GetJSON
	testData := map[string]interface{}{
		"device_id": "test-001",
		"value":     23.5,
		"unit":      "°C",
	}

	err := repo.SetJSON("test:key", testData, 1*time.Minute)
	if err != nil {
		t.Fatalf("Failed to set JSON: %v", err)
	}

	var result map[string]interface{}
	err = repo.GetJSON("test:key", &result)
	if err != nil {
		t.Fatalf("Failed to get JSON: %v", err)
	}

	if result["value"] != 23.5 {
		t.Errorf("Expected value 23.5, got %v", result["value"])
	}

	// Test Delete
	err = repo.Delete("test:key")
	if err != nil {
		t.Fatalf("Failed to delete key: %v", err)
	}

	err = repo.GetJSON("test:key", &result)
	if err == nil {
		t.Error("Expected error getting deleted key, got nil")
	}

	// Test Device Status methods
	err = repo.SetDeviceStatus("test-device", string(domain.DeviceStatusOnline))
	if err != nil {
		t.Fatalf("Failed to set device status: %v", err)
	}

	status, err := repo.GetDeviceStatus("test-device")
	if err != nil {
		t.Fatalf("Failed to get device status: %v", err)
	}

	if status != string(domain.DeviceStatusOnline) {
		t.Errorf("Expected status online, got %s", status)
	}
}
