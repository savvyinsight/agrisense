package main

import (
	"fmt"
	"log"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/config"
	"github.com/savvyinsight/agrisenseiot/internal/repository/influxdb"
	"github.com/savvyinsight/agrisenseiot/internal/repository/postgres"
	"github.com/savvyinsight/agrisenseiot/internal/repository/redis"
	"github.com/savvyinsight/agrisenseiot/internal/ruleengine"
	"github.com/savvyinsight/agrisenseiot/internal/service/data"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	// Setup PostgreSQL
	pgDB, err := postgres.NewConnection(postgres.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		DBName:   cfg.DBName,
		SSLMode:  cfg.DBSSLMode,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer pgDB.Close()

	// Setup Redis
	redisClient, err := redis.NewConnection(redis.Config{
		Host: cfg.RedisHost,
		Port: cfg.RedisPort,
		DB:   cfg.RedisDB,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer redisClient.Close()

	// Setup InfluxDB
	influxRepo, err := influxdb.NewRepository(influxdb.Config{
		URL:    cfg.InfluxURL,
		Token:  cfg.InfluxToken,
		Org:    cfg.InfluxOrg,
		Bucket: cfg.InfluxBucket,
	})
	if err != nil {
		log.Fatal(err)
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

	// Create data service
	dataService := data.NewService(
		sensorTypeRepo,
		deviceRepo,
		cacheRepo,
		influxRepo,
		ruleEngine,
	)

	// Test 1: Get latest reading
	fmt.Println("=== Testing GetLatestReading ===")
	temp, err := dataService.GetLatestReading("sim-device-01", "temperature")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Latest temperature: %.2f at %v\n", temp.Value, temp.Timestamp)
	}

	// Test 2: Get historical data
	fmt.Println("\n=== Testing GetHistoricalData ===")
	end := time.Now()
	start := end.Add(-1 * time.Hour)

	history, err := dataService.GetHistoricalData("sim-device-01", "temperature", start, end)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Found %d historical records\n", len(history))
		if len(history) > 0 {
			fmt.Printf("First: %.2f at %v\n", history[0].Value, history[0].Timestamp)
		}
	}

	// Test 3: Get aggregated data
	fmt.Println("\n=== Testing GetAggregatedData ===")
	agg, err := dataService.GetAggregatedData("sim-device-01", "temperature", start, end, "10m")
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Printf("Found %d aggregated records\n", len(agg))
		for i, a := range agg {
			if i < 3 { // Show first 3
				fmt.Printf("  %v: avg=%.2f\n", a.Timestamp, a.Avg)
			}
		}
	}
}
