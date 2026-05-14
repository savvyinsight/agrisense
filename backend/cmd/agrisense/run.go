package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/urfave/cli/v2"
	"golang.org/x/sync/errgroup"

	// Internal packages
	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/analytics"
	"github.com/savvyinsight/agrisense/internal/automation"
	"github.com/savvyinsight/agrisense/internal/config"
	"github.com/savvyinsight/agrisense/internal/control"
	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/infra/postgres"
	"github.com/savvyinsight/agrisense/internal/irrigation"
	"github.com/savvyinsight/agrisense/internal/weather"
	"github.com/savvyinsight/agrisense/internal/infra/redis"
	"github.com/savvyinsight/agrisense/internal/middleware"
	"github.com/savvyinsight/agrisense/internal/mqtt"
	mqtthandlers "github.com/savvyinsight/agrisense/internal/mqtt/handlers"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/user"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

func runServer(cliCtx *cli.Context) error {
	// ── 1. Load configuration ───────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// ── 2. Setup infrastructure ────────────────────────────────────
	// PostgreSQL
	pgDB, err := postgres.NewConnection(postgres.Config{
		Host: cfg.DBHost, Port: cfg.DBPort, User: cfg.DBUser,
		Password: cfg.DBPassword, DBName: cfg.DBName, SSLMode: cfg.DBSSLMode,
	})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer func() {
		if err := pgDB.Close(); err != nil {
			log.Printf("Failed to close PostgreSQL connection: %v", err)
		}
	}()

	// Redis
	redisClient, err := redis.NewConnection(redis.Config{
		Host: cfg.RedisHost, Port: cfg.RedisPort,
		Password: cfg.RedisPassword, DB: cfg.RedisDB,
	})
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer func() {
		if err := redisClient.Close(); err != nil {
			log.Printf("Failed to close Redis connection: %v", err)
		}
	}()

	// InfluxDB
	influxRepo, err := sensor.NewRepository(sensor.Config{
		URL: cfg.InfluxURL, Token: cfg.InfluxToken,
		Org: cfg.InfluxOrg, Bucket: cfg.InfluxBucket,
	})
	if err != nil {
		log.Fatalf("Failed to connect to InfluxDB: %v", err)
	}
	defer influxRepo.Close()

	// ── 3. Create repositories ─────────────────────────────────────
	userRepo := &user.PostgresUserRepository{DB: pgDB}
	deviceRepo := &device.PostgresDeviceRepository{DB: pgDB}
	sensorTypeRepo := &sensor.PostgresSensorTypeRepository{DB: pgDB}
	cmdRepo := &control.PostgresCommandRepository{DB: pgDB}
	alertRuleRepo := &alert.PostgresAlertRuleRepository{DB: pgDB}
	alertRepo := &alert.PostgresAlertRepository{DB: pgDB}
	fieldRepo := &field.PostgresFieldRepository{DB: pgDB}
	irrigationRepo := &irrigation.PostgresIrrigationZoneRepository{DB: pgDB}
	weatherRepo := &weather.PostgresWeatherRepository{DB: pgDB}
	cacheRepo := redis.NewCacheRepository(redisClient)

	// ── 4. Create services ─────────────────────────────────────────
	authService := user.NewService(userRepo, cfg.JWTSecret, 24*time.Hour)
	wsHandler := websocket.NewHander(authService)

	// Rule engine
	ruleEngine := ruleengine.NewEngine(alertRuleRepo, alertRepo, deviceRepo)
	if err := ruleEngine.Start(); err != nil {
		log.Fatalf("Failed to start rule engine: %v", err)
	}
	defer ruleEngine.Stop()

	// Data service
	dataService := data.NewService(sensorTypeRepo, deviceRepo, cacheRepo, influxRepo, ruleEngine)

	// MQTT client (for publishing commands from the API server)
	mqttClient, err := mqtt.NewClient(mqtt.Config{
		Broker: cfg.MQTTBroker, ClientID: "agrisense-server",
		Username: cfg.MQTTUsername, Password: cfg.MQTTPassword,
	}, nil) // nil handlers — server only publishes
	if err != nil {
		log.Fatalf("Failed to create MQTT client: %v", err)
	}
	defer mqttClient.Disconnect()

	// Control service
	controlService := control.NewService(cmdRepo, deviceRepo,
		func(deviceID string, payload []byte) error {
			return mqttClient.PublishCommand(deviceID, payload)
		},
	)

	// Automation service
	automationService := automation.NewService(
		automation.PostgresAutomationRuleRepository{DB: pgDB},
		deviceRepo, controlService,
	)
	if err := automationService.Start(); err != nil {
		log.Fatalf("Failed to start automation service: %v", err)
	}
	defer automationService.Stop()
	dataService.SetAutomationService(automationService)

	// Alert service
	alertService := alert.NewService(alertRepo, alertRuleRepo, deviceRepo)

	// Analytics service
	analyticsService := analytics.NewService(deviceRepo, sensorTypeRepo,
		dataService.GetHistoricalData,
	)

	// ── 5. MQTT handler (runs in the same process!) ────────────────
	// Create MQTT handler services (same as old mqtt-handler/main.go)
	mqtthandlers.Init(dataService, deviceRepo)

	// Response callback for command responses
	responseCallback := func(deviceID string, payload []byte) {
		controlService.HandleCommandResponse(deviceID, payload)
	}

	// MQTT service (subscriber)
	mqttService, err := mqtt.NewService(mqtt.Config{
		Broker: cfg.MQTTBroker, ClientID: "agrisense-mqtt-handler",
		Username: cfg.MQTTUsername, Password: cfg.MQTTPassword,
	}, dataService,
		mqtthandlers.HandleTelemetry,
		mqtthandlers.HandleHeartbeat,
		func(deviceID string, payload []byte) {
			mqtthandlers.HandleResponse(deviceID, payload, responseCallback)
		},
	)
	if err != nil {
		log.Fatalf("Failed to create MQTT service: %v", err)
	}

	// Set publish function in control service
	controlService.SetPublishFunc(func(deviceID string, payload []byte) error {
		return mqttService.SendCommand(deviceID, payload)
	})

	// ── 6. Create HTTP handlers ────────────────────────────────────
	authHandler := user.NewAuthHandler(authService)
	deviceHandler := device.NewDeviceHandler(deviceRepo)
	dataHandler := data.NewDataHandler(dataService, deviceRepo)
	alertHandler := alert.NewAlertHandler(alertService)
	controlHandler := control.NewControlHandler(controlService)
	automationHandler := automation.NewAutomationHandler(automationService)
	fieldHandler := field.NewFieldHandler(fieldRepo)
	irrigationHandler := irrigation.NewIrrigationHandler(irrigationRepo)
	weatherHandler := weather.NewWeatherHandler(weatherRepo)
	analyticsHandler := analytics.NewAnalyticsHandler(analyticsService)

	// ── 7. Setup HTTP router ──────────────────────────────────────
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			return origin == "" ||
				strings.HasPrefix(origin, "http://localhost:") ||
				origin == "https://agrisense-frontend-bice.vercel.app"
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	r.Use(middleware.MetricsMiddleware())

	// WebSocket
	r.GET("/ws", wsHandler.HandleWebSocket)
	r.POST("/internal/broadcast", func(c *gin.Context) {
		var msg map[string]interface{}
		if err := c.BindJSON(&msg); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}
		wsHub := websocket.GetHub()
		wsHub.BroadcastAll(msg)
		c.Status(200)
	})

	// Public routes
	authGroup := r.Group("/api/v1/auth")
	{
		authGroup.POST("/register", authHandler.Register)
		authGroup.POST("/login", authHandler.Login)
	}

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(user.AuthMiddleware(authService))
	{
		// Device routes
		devices := api.Group("/devices")
		{
			devices.POST("", deviceHandler.Create)
			devices.GET("", deviceHandler.List)
			devices.GET("/:id", deviceHandler.GetByID)
			devices.PUT("/:id", deviceHandler.Update)
			devices.DELETE("/:id", deviceHandler.Delete)
		}

		// Data routes
		data := api.Group("/devices/:id/data") // Change from :deviceId to :id
		{
			data.GET("/latest", dataHandler.GetLatest)         // Now /devices/:id/data/latest
			data.GET("", dataHandler.GetHistorical)            // Now /devices/:id/data ; // No trailing slash
			data.GET("/aggregated", dataHandler.GetAggregated) // Now /devices/:id/data/aggregated
		}

		// Bulk data routes (for map view, dashboards)
		api.GET("/devices/data/latest", dataHandler.GetLatestForMultipleDevices) // /api/v1/devices/data/latest?device_ids=1,2,3

		// Alert routes
		alerts := api.Group("/alerts")
		{
			alerts.GET("/active", alertHandler.GetActiveAlerts)
			alerts.GET("/history", alertHandler.GetAlertHistory)
			alerts.POST("/rules", alertHandler.CreateRule)
			alerts.GET("/rules", alertHandler.ListRules)
			alerts.GET("/rules/:id", alertHandler.GetRule)
			alerts.PUT("/rules/:id", alertHandler.UpdateRule)
			alerts.DELETE("/rules/:id", alertHandler.DeleteRule)
			alerts.POST("/:id/acknowledge", alertHandler.AcknowledgeAlert)
			alerts.POST("/:id/resolve", alertHandler.ResolveAlert)
		}

		// Automation routes
		automation := api.Group("/automation")
		{
			automation.POST("/rules", automationHandler.CreateRule)
			automation.GET("/rules", automationHandler.ListRules)
			automation.GET("/rules/:id", automationHandler.GetRule)
			automation.PUT("/rules/:id", automationHandler.UpdateRule)
			automation.DELETE("/rules/:id", automationHandler.DeleteRule)
		}

		// Field routes
		fields := api.Group("/fields")
		{
			fields.POST("", fieldHandler.Create)
			fields.GET("", fieldHandler.List)
			fields.GET("/:id", fieldHandler.GetByID)
			fields.PUT("/:id", fieldHandler.Update)
			fields.DELETE("/:id", fieldHandler.Delete)
		}

		// Irrigation routes
		irrigationRoutes := api.Group("/irrigation/zones")
		{
			irrigationRoutes.GET("", irrigationHandler.List)
			irrigationRoutes.POST("/:id/start", irrigationHandler.Start)
			irrigationRoutes.POST("/:id/stop", irrigationHandler.Stop)
			irrigationRoutes.POST("/:id/retry", irrigationHandler.Retry)
		}

		// Weather routes
		api.GET("/weather/current", weatherHandler.GetCurrent)

		// Analytics routes
		analyticsGroup := api.Group("/analytics")
		{
			analyticsGroup.GET("/report", analyticsHandler.GetReport)
		}

		// Control routes
		deviceGroup := api.Group("/devices/:id")
		{
			deviceGroup.POST("/commands", controlHandler.SendCommand)
			deviceGroup.GET("/commands", controlHandler.ListDeviceCommands)
			deviceGroup.GET("/commands/:cmdId", controlHandler.GetCommandStatus)
		}
	}

	// Metrics & health
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// ── 8. Start everything with graceful shutdown ─────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	g, ctx := errgroup.WithContext(ctx)

	// HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	g.Go(func() error {
		log.Printf("HTTP server starting on port %s", cfg.Port)
		go func() {
			<-ctx.Done()
			log.Println("Shutting down HTTP server...")
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := srv.Shutdown(shutdownCtx); err != nil {
				log.Printf("HTTP shutdown error: %v", err)
			}
		}()
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	// MQTT subscriber
	g.Go(func() error {
		if err := mqttService.Start(); err != nil {
			return err
		}
		log.Println("MQTT handler started. Waiting for messages...")
		<-ctx.Done()
		mqttService.Stop()
		return nil
	})

	// Signal handler
	g.Go(func() error {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		select {
		case sig := <-sigChan:
			log.Printf("Received signal: %v. Shutting down...", sig)
			cancel()
		case <-ctx.Done():
		}
		return nil
	})

	if err := g.Wait(); err != nil && err != http.ErrServerClosed {
		log.Printf("Server error: %v", err)
	}

	log.Println("AgriSense shut down gracefully")
	return nil
}
