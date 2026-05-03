package main

import (
	"log"
	"net/http/pprof"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/savvyinsight/agrisenseiot/internal/config"
	"github.com/savvyinsight/agrisenseiot/internal/handler/rest"
	"github.com/savvyinsight/agrisenseiot/internal/handler/websocket"
	"github.com/savvyinsight/agrisenseiot/internal/middleware"
	"github.com/savvyinsight/agrisenseiot/internal/mqtt"
	"github.com/savvyinsight/agrisenseiot/internal/repository/influxdb"
	"github.com/savvyinsight/agrisenseiot/internal/repository/postgres"
	"github.com/savvyinsight/agrisenseiot/internal/repository/redis"
	"github.com/savvyinsight/agrisenseiot/internal/ruleengine"
	"github.com/savvyinsight/agrisenseiot/internal/service/alert"
	"github.com/savvyinsight/agrisenseiot/internal/service/analytics"
	"github.com/savvyinsight/agrisenseiot/internal/service/auth"
	"github.com/savvyinsight/agrisenseiot/internal/service/automation"
	"github.com/savvyinsight/agrisenseiot/internal/service/control"
	"github.com/savvyinsight/agrisenseiot/internal/service/data"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Setup PostgreSQL
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

	// Setup Redis
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

	// Setup InfluxDB
	influxConfig := influxdb.Config{
		URL:    cfg.InfluxURL,
		Token:  cfg.InfluxToken,
		Org:    cfg.InfluxOrg,
		Bucket: cfg.InfluxBucket,
	}
	influxRepo, err := influxdb.NewRepository(influxConfig)
	if err != nil {
		log.Fatalf("Failed to connect to InfluxDB: %v", err)
	}
	defer influxRepo.Close()

	// Create repositories
	userRepo := &postgres.UserRepository{DB: pgDB}
	deviceRepo := &postgres.DeviceRepository{DB: pgDB}
	sensorTypeRepo := &postgres.SensorTypeRepository{DB: pgDB}
	cacheRepo := redis.NewCacheRepository(redisClient)

	// 1. Create MQTT client for sending commands (publisher only)
	mqttClient, err := mqtt.NewClient(mqtt.Config{
		Broker:   cfg.MQTTBroker,
		ClientID: "agrisense-server",
		Username: cfg.MQTTUsername,
		Password: cfg.MQTTPassword,
	}, nil) // nil handlers since server only publishes
	if err != nil {
		log.Fatalf("Failed to create MQTT client: %v", err)
	}
	defer mqttClient.Disconnect()

	// 2. Create services that don't depend on each other
	authService := auth.NewService(userRepo, cfg.JWTSecret, 24*time.Hour)
	wsHander := websocket.NewHander(authService)
	ruleEngine := ruleengine.NewEngine(
		&postgres.AlertRuleRepository{DB: pgDB},
		&postgres.AlertRepository{DB: pgDB},
		deviceRepo,
	)
	ruleEngine.Start()
	defer ruleEngine.Stop()

	// 3. Create data service (needs ruleEngine)
	dataService := data.NewService(
		sensorTypeRepo,
		deviceRepo,
		cacheRepo,
		influxRepo,
		ruleEngine,
	)

	// 4. Create control service with injected publish function
	controlService := control.NewService(
		&postgres.CommandRepository{DB: pgDB},
		deviceRepo,
		func(deviceID string, payload []byte) error {
			return mqttClient.PublishCommand(deviceID, payload)
		},
	)

	// 5. Create alert service
	alertService := alert.NewService(
		&postgres.AlertRepository{DB: pgDB},
		&postgres.AlertRuleRepository{DB: pgDB},
		deviceRepo,
	)

	// 6. Create automation service
	automationService := automation.NewService(
		&postgres.AutomationRuleRepository{DB: pgDB},
		deviceRepo,
		controlService, // controlService implements CommandExecutor
	)
	automationService.Start()
	defer automationService.Stop()

	// Set automation service in data service
	dataService.SetAutomationService(automationService)

	// 7. Create analytics service
	analyticsService := analytics.NewService(
		deviceRepo,
		sensorTypeRepo,
		dataService.GetHistoricalData,
	)

	// Create handlers
	authHandler := rest.NewAuthHandler(authService)
	deviceHandler := rest.NewDeviceHandler(deviceRepo)
	dataHandler := rest.NewDataHandler(dataService)
	alertHandler := rest.NewAlertHandler(alertService)
	controlHandler := rest.NewControlHandler(controlService)
	automationHandler := rest.NewAutomationHandler(automationService)
	analyticsHandler := rest.NewAnalyticsHandler(analyticsService)

	// Setup Gin router
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "https://agrisense-frontend-bice.vercel.app"}, // frontend URL
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))
	r.Use(middleware.MetricsMiddleware())

	r.GET("/ws", wsHander.HandleWebSocket)
	r.POST("/internal/broadcast", func(c *gin.Context) {
		var msg map[string]interface{}
		c.BindJSON(&msg)
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
	api.Use(middleware.AuthMiddleware(authService))
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
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// pprof routes
	r.GET("/debug/pprof/", gin.WrapH(pprof.Handler("index")))
	r.GET("/debug/pprof/heap", gin.WrapH(pprof.Handler("heap")))
	r.GET("/debug/pprof/goroutine", gin.WrapH(pprof.Handler("goroutine")))
	r.GET("/debug/pprof/block", gin.WrapH(pprof.Handler("block")))
	r.GET("/debug/pprof/threadcreate", gin.WrapH(pprof.Handler("threadcreate")))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("Server starting on port %s", cfg.Port)
	r.Run(":" + cfg.Port)
}
