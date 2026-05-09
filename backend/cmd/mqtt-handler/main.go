package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/config"
	"github.com/savvyinsight/agrisense/internal/control"
	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/infra/postgres"
	"github.com/savvyinsight/agrisense/internal/infra/redis"
	"github.com/savvyinsight/agrisense/internal/mqtt"
	"github.com/savvyinsight/agrisense/internal/mqtt/handlers"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
)

func main() {
	// Load config
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
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
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
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
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// Setup InfluxDB connection
	influxConfig := sensor.Config{
		URL:    cfg.InfluxURL,
		Token:  cfg.InfluxToken,
		Org:    cfg.InfluxOrg,
		Bucket: cfg.InfluxBucket,
	}
	influxRepo, err := sensor.NewRepository(influxConfig)
	if err != nil {
		log.Fatalf("Failed to connect to InfluxDB: %v", err)
	}
	defer influxRepo.Close()

	// Create repositories
	deviceRepo := &device.PostgresDeviceRepository{DB: pgDB}
	sensorTypeRepo := &sensor.PostgresSensorTypeRepository{DB: pgDB}
	// cacheRepo := redis.NewCacheRepository(redisClient)
	cmdRepo := &control.PostgresCommandRepository{DB: pgDB}

	// Create rule engine
	ruleEngine := ruleengine.NewEngine(
		&alert.PostgresAlertRuleRepository{DB: pgDB},
		&alert.PostgresAlertRepository{DB: pgDB},
		&device.PostgresDeviceRepository{DB: pgDB},
	)
	ruleEngine.Start()
	defer ruleEngine.Stop()

	// Create data service
	dataService := data.NewService(
		sensorTypeRepo,
		deviceRepo,
		// cacheRepo,
		influxRepo,
		ruleEngine,
	)

	// initialize mqtt with data service and device repository for status management
	handlers.Init(dataService, deviceRepo)

	// Create control service FIRST (before MQTT)
	controlService := control.NewService(
		cmdRepo,
		deviceRepo,
		nil, // Will set after MQTT is created
	)

	// Create response callback
	responseCallback := func(deviceID string, payload []byte) {
		controlService.HandleCommandResponse(deviceID, payload)
	}

	// Create MQTT service ONCE with all handlers
	mqttService, err := mqtt.NewService(
		mqtt.Config{
			Broker:   cfg.MQTTBroker,
			ClientID: "agrisense-mqtt-handler",
			Username: cfg.MQTTUsername,
			Password: cfg.MQTTPassword,
		},
		dataService,
		handlers.HandleTelemetry,
		handlers.HandleHeartbeat,
		func(deviceID string, payload []byte) {
			handlers.HandleResponse(deviceID, payload, responseCallback)
		},
	)
	if err != nil {
		log.Fatalf("Failed to create MQTT service: %v", err)
	}

	// Now set the publish function in control service
	// You'll need to add this method to control.Service
	controlService.SetPublishFunc(func(deviceID string, payload []byte) error {
		return mqttService.SendCommand(deviceID, payload)
	})

	// Start MQTT service
	if err := mqttService.Start(); err != nil {
		log.Fatalf("Failed to start MQTT service: %v", err)
	}

	log.Println("MQTT handler started. Waiting for messages...")

	// Wait for interrupt signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	// Graceful shutdown
	log.Println("Shutting down MQTT handler...")
	mqttService.Stop()
}
