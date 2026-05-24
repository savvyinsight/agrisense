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
	"github.com/savvyinsight/agrisense/internal/escalation"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/infra/postgres"
	"github.com/savvyinsight/agrisense/internal/irrigation"
	"github.com/savvyinsight/agrisense/internal/infra/redis"
	"github.com/savvyinsight/agrisense/internal/middleware"
	"github.com/savvyinsight/agrisense/internal/mqtt"
	mqtthandlers "github.com/savvyinsight/agrisense/internal/mqtt/handlers"
	"github.com/savvyinsight/agrisense/internal/notification"
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

	// Run database migrations
	if err := postgres.RunMigrations(postgres.Config{
		Host: cfg.DBHost, Port: cfg.DBPort, User: cfg.DBUser,
		Password: cfg.DBPassword, DBName: cfg.DBName, SSLMode: cfg.DBSSLMode,
	}); err != nil {
		log.Fatalf("Failed to run database migrations: %v", err)
	}

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
	irrigationEventRepo := &irrigation.PostgresIrrigationEventRepository{DB: pgDB}
	cacheRepo := redis.NewCacheRepository(redisClient)

	// Multi-tenant RBAC repositories
	accountRepo := &user.PostgresAccountRepository{DB: pgDB}
	permissionRepo := &user.PostgresPermissionRepository{DB: pgDB}
	invitationRepo := &user.PostgresInvitationRepository{DB: pgDB}
	auditRepo := &user.PostgresAuditLogRepository{DB: pgDB}

	// ── 4. Create services ─────────────────────────────────────────
	authService := user.NewService(userRepo, accountRepo, permissionRepo, invitationRepo, cfg.JWTSecret, 24*time.Hour)
	wsHandler := websocket.NewHander(authService)

	// Rule engine
	ruleEngine := ruleengine.NewEngine(alertRuleRepo, alertRepo, deviceRepo, fieldRepo)
	if err := ruleEngine.Start(); err != nil {
		log.Fatalf("Failed to start rule engine: %v", err)
	}
	defer ruleEngine.Stop()

	// Data service
	dataService := data.NewService(sensorTypeRepo, deviceRepo, cacheRepo, influxRepo, ruleEngine, fieldRepo)

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
		&automation.PostgresAutomationRuleRepository{DB: pgDB},
		deviceRepo, controlService,
	)
	if err := automationService.Start(); err != nil {
		log.Fatalf("Failed to start automation service: %v", err)
	}
	defer automationService.Stop()
	dataService.SetAutomationService(automationService)

	// Alert service
	alertService := alert.NewService(alertRepo, alertRuleRepo, deviceRepo, fieldRepo)

	// Notification service
	notifChannelRepo := &notification.PostgresChannelRepository{DB: pgDB}
	notifRoutingRepo := &notification.PostgresRoutingRuleRepository{DB: pgDB}
	notifService := notification.NewService(notifChannelRepo, notifRoutingRepo)

	// Escalation service
	escRuleRepo := &escalation.PostgresEscalationRuleRepository{DB: pgDB}
	escHistoryRepo := &escalation.PostgresEscalationHistoryRepository{DB: pgDB}
	escalationService := escalation.NewService(escRuleRepo, escHistoryRepo)

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
	deviceHandler := device.NewDeviceHandler(deviceRepo, accountRepo)
	dataHandler := data.NewDataHandler(dataService, deviceRepo)
	alertHandler := alert.NewAlertHandler(alertService)
	controlHandler := control.NewControlHandler(controlService)
	automationHandler := automation.NewAutomationHandler(automationService)
	fieldHandler := field.NewFieldHandler(fieldRepo)
	irrigationHandler := irrigation.NewIrrigationHandler(irrigationRepo, irrigationEventRepo, irrigationCmdAdapter{controlService})
	analyticsHandler := analytics.NewAnalyticsHandler(analyticsService, deviceRepo)
	notifHandler := notification.NewHandler(notifService)
	escHandler := escalation.NewHandler(escalationService)
	
	// Multi-tenant RBAC handler
	userHandler := &user.UserHandler{
		UserRepo:       userRepo,
		AccountRepo:    accountRepo,
		PermissionRepo: permissionRepo,
		InvitationRepo: invitationRepo,
		AuditRepo:      auditRepo,
	}

	// Platform admin handler
	adminHandler := &user.AdminHandler{
		UserRepo:       userRepo,
		AccountRepo:    accountRepo,
		PermissionRepo: permissionRepo,
		AuditRepo:      auditRepo,
		DB:             pgDB,
	}

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

	// Public invitation lookup (no auth required)
	r.GET("/api/v1/invitations/:token", user.GetInvitationHandler(invitationRepo, accountRepo))

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(user.AuthMiddleware(authService))
	{
		// Device routes
		devices := api.Group("/devices")
		{
			devices.POST("", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), deviceHandler.Create)
			devices.GET("", deviceHandler.List)
			devices.POST("/claim", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), deviceHandler.ClaimDeviceHandler)
			devices.GET("/:id", deviceHandler.GetByID)
			devices.PUT("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), deviceHandler.Update)
			devices.DELETE("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), deviceHandler.Delete)
			devices.POST("/:id/unclaim", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), deviceHandler.UnclaimDeviceHandler)
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
			alerts.POST("/rules", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), alertHandler.CreateRule)
			alerts.GET("/rules", alertHandler.ListRules)
			alerts.GET("/rules/:id", alertHandler.GetRule)
			alerts.PUT("/rules/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), alertHandler.UpdateRule)
			alerts.DELETE("/rules/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), alertHandler.DeleteRule)
			alerts.POST("/:id/acknowledge", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), alertHandler.AcknowledgeAlert)
			alerts.POST("/:id/resolve", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), alertHandler.ResolveAlert)
			alerts.POST("/:id/snooze", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), alertHandler.SnoozeAlert)
			alerts.POST("/:id/unsnooze", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), alertHandler.UnsnoozeAlert)
			alerts.GET("/correlations", alertHandler.GetAlertCorrelations)
			alerts.GET("/:id/escalation-history", escHandler.GetHistory)
		}

		// Automation routes
		automation := api.Group("/automation")
		{
			automation.POST("/rules", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), automationHandler.CreateRule)
			automation.GET("/rules", automationHandler.ListRules)
			automation.GET("/rules/:id", automationHandler.GetRule)
			automation.PUT("/rules/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), automationHandler.UpdateRule)
			automation.DELETE("/rules/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), automationHandler.DeleteRule)
			automation.PUT("/rules/:id/pause", automationHandler.PauseRule)
			automation.PUT("/rules/:id/resume", automationHandler.ResumeRule)
			automation.POST("/rules/:id/execute", automationHandler.ExecuteNow)
			automation.GET("/rules/:id/commands", automationHandler.GetCommandHistory)
			automation.GET("/dashboard", automationHandler.GetDashboard)
			automation.POST("/global-toggle", automationHandler.SetGlobalAutomation)
		}

		// Notification routes
		notifications := api.Group("/notifications")
		{
			notifications.GET("/settings", notifHandler.GetSettings)
			notifications.POST("/channels", notifHandler.CreateChannel)
			notifications.PUT("/channels/:id", notifHandler.UpdateChannel)
			notifications.DELETE("/channels/:id", notifHandler.DeleteChannel)
			notifications.PUT("/routing/:id", notifHandler.UpdateRoutingRule)
			notifications.POST("/channels/:id/test", notifHandler.TestChannel)
		}

		// Escalation routes
		escRoutes := api.Group("/alerts/escalation-rules")
		{
			escRoutes.GET("", escHandler.ListRules)
			escRoutes.POST("", escHandler.CreateRule)
			escRoutes.GET("/:id", escHandler.GetRule)
			escRoutes.PUT("/:id", escHandler.UpdateRule)
			escRoutes.DELETE("/:id", escHandler.DeleteRule)
		}

		// Field routes
		fields := api.Group("/fields")
		{
			fields.POST("", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), fieldHandler.Create)
			fields.GET("", fieldHandler.List)
			fields.GET("/:id", fieldHandler.GetByID)
			fields.PUT("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), fieldHandler.Update)
			fields.DELETE("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), fieldHandler.Delete)
		}

		// Irrigation routes
		irrigationRoutes := api.Group("/irrigation/zones")
		{
			irrigationRoutes.GET("", irrigationHandler.List)
			irrigationRoutes.POST("", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), irrigationHandler.Create)
			irrigationRoutes.PUT("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), irrigationHandler.Update)
			irrigationRoutes.DELETE("/:id", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager"), irrigationHandler.Delete)
			irrigationRoutes.POST("/:id/start", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), irrigationHandler.Start)
			irrigationRoutes.POST("/:id/stop", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), irrigationHandler.Stop)
			irrigationRoutes.POST("/:id/retry", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), irrigationHandler.Retry)
			irrigationRoutes.GET("/events", irrigationHandler.ListEvents)
		}

		// Analytics routes
		analyticsGroup := api.Group("/analytics")
		{
			analyticsGroup.GET("/report", analyticsHandler.GetReport)
		}

		// Control routes
		deviceGroup := api.Group("/devices/:id")
		{
			deviceGroup.POST("/commands", middleware.GinRequireRole(permissionRepo, "account_owner", "farm_manager", "operator"), controlHandler.SendCommand)
			deviceGroup.GET("/commands", controlHandler.ListDeviceCommands)
			deviceGroup.GET("/commands/:cmdId", controlHandler.GetCommandStatus)
		}

		// Multi-tenant RBAC routes (with tenant isolation)
		accounts := api.Group("/accounts/:id", middleware.GinTenantIsolationMiddleware())
		{
			// Team management
			accounts.GET("/users", userHandler.ListTeamHandler)
			accounts.POST("/users/invite", userHandler.InviteUserHandler)
			accounts.PUT("/users/permission", userHandler.UpdateUserPermissionHandler)
			accounts.DELETE("/users/permission", userHandler.RevokeUserHandler)

			// Audit log
			accounts.GET("/audit", userHandler.GetAuditLogHandler)
		}

		// Platform admin routes (admin role only — no tenant isolation)
		admin := api.Group("/admin", middleware.PlatformAdminMiddleware())
		{
		admin.GET("/accounts", adminHandler.ListAccountsHandler)
			admin.GET("/accounts/:id", adminHandler.GetAccountDetailHandler)
			admin.PATCH("/accounts/:id", adminHandler.UpdateAccountHandler)
			admin.POST("/accounts/:id/users", adminHandler.CreateUserInAccountHandler)
			admin.DELETE("/accounts/:id/users/:uid", adminHandler.RemoveUserFromAccountHandler)
			admin.GET("/audit", adminHandler.GetGlobalAuditLogHandler)
			admin.GET("/stats", adminHandler.GetPlatformStatsHandler)
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

// irrigationCmdAdapter adapts control.Service to irrigation.CommandSender.
type irrigationCmdAdapter struct {
	svc *control.Service
}

func (a irrigationCmdAdapter) SendCommand(deviceID int, command string, parameters map[string]interface{}, userID int) error {
	_, err := a.svc.ExecuteCommand(deviceID, command, parameters, &userID)
	return err
}
