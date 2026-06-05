//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/infra/redis"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/user"
	"github.com/stretchr/testify/require"
)

type registerResponse struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type loginResponse struct {
	Token string    `json:"token"`
	User  user.User `json:"user"`
}

type deviceResponse struct {
	ID       int    `json:"id"`
	DeviceID string `json:"device_id"`
	Name     string `json:"name"`
}

func setupAPIRouter(t *testing.T) (*gin.Engine, *data.Service) {
	userRepo := &user.PostgresUserRepository{DB: testDB}
	deviceRepo := &device.PostgresDeviceRepository{DB: testDB}
	sensorTypeRepo := &sensor.PostgresSensorTypeRepository{DB: testDB}
	cacheRepo := redis.NewCacheRepository(testRedis)
	fieldRepo := &field.PostgresFieldRepository{DB: testDB}
	accountRepo := &user.PostgresAccountRepository{DB: testDB}
	permissionRepo := &user.PostgresPermissionRepository{DB: testDB}
	invitationRepo := &user.PostgresInvitationRepository{DB: testDB}

	influxRepo, err := sensor.NewRepository(sensor.Config{
		URL:    testInfluxURL,
		Token:  testInfluxToken,
		Org:    "test-org",
		Bucket: "test-bucket",
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		influxRepo.Close()
	})

	ruleEngine := ruleengine.NewEngine(
		&alert.PostgresAlertRuleRepository{DB: testDB},
		&alert.PostgresAlertRepository{DB: testDB},
		deviceRepo,
		fieldRepo,
		sensorTypeRepo,
	)
	require.NoError(t, ruleEngine.Start())
	t.Cleanup(func() {
		ruleEngine.Stop()
	})

	dataService := data.NewService(
		sensorTypeRepo,
		deviceRepo,
		cacheRepo,
		influxRepo,
		ruleEngine,
		fieldRepo,
	)

	platformAdminRepo := &user.PostgresPlatformAdminRepository{DB: testDB}
	authService := user.NewService(userRepo, accountRepo, permissionRepo, invitationRepo, platformAdminRepo, "test-secret", time.Hour)
	authHandler := user.NewAuthHandler(authService)
	deviceHandler := device.NewDeviceHandler(deviceRepo, accountRepo)
	dataHandler := data.NewDataHandler(dataService, deviceRepo)

	r := gin.Default()

	r.POST("/api/v1/auth/register", authHandler.Register)
	r.POST("/api/v1/auth/login", authHandler.Login)

	api := r.Group("/api/v1")
	api.Use(user.AuthMiddleware(authService))
	{
		devices := api.Group("/devices")
		devices.POST("", deviceHandler.Create)
		devices.GET("", deviceHandler.List)

		dataGroup := api.Group("/devices/:id/data")
		dataGroup.GET("/latest", dataHandler.GetLatest)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return r, dataService
}

func doRequest(t *testing.T, router *gin.Engine, method, url string, body interface{}, token string) *httptest.ResponseRecorder {
	var reqBody bytes.Buffer
	if body != nil {
		err := json.NewEncoder(&reqBody).Encode(body)
		require.NoError(t, err)
	}

	req, err := http.NewRequest(method, url, &reqBody)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestAPIFlow(t *testing.T) {
	router, dataService := setupAPIRouter(t)

	registerPayload := map[string]string{
		"username": "integration_user",
		"email":    fmt.Sprintf("integration_%d@example.com", time.Now().UnixNano()),
		"password": "secret123",
	}

	w := doRequest(t, router, http.MethodPost, "/api/v1/auth/register", registerPayload, "")
	require.Equal(t, http.StatusCreated, w.Code)

	loginPayload := map[string]string{
		"email":    registerPayload["email"],
		"password": registerPayload["password"],
	}
	w = doRequest(t, router, http.MethodPost, "/api/v1/auth/login", loginPayload, "")
	require.Equal(t, http.StatusOK, w.Code)

	var loginResp loginResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &loginResp))
	require.NotEmpty(t, loginResp.Token)

	createDevicePayload := map[string]interface{}{
		"device_id": "integration-device-001",
		"name":      "Integration Device",
		"type":      "sensor",
	}
	w = doRequest(t, router, http.MethodPost, "/api/v1/devices", createDevicePayload, loginResp.Token)
	require.Equal(t, http.StatusCreated, w.Code)

	var createdDevice deviceResponse
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &createdDevice))
	require.Equal(t, "integration-device-001", createdDevice.DeviceID)

	w = doRequest(t, router, http.MethodGet, "/api/v1/devices?limit=10", nil, loginResp.Token)
	require.Equal(t, http.StatusOK, w.Code)

	var listResp struct {
		Devices []deviceResponse `json:"devices"`
		Total   int              `json:"total"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &listResp))
	require.GreaterOrEqual(t, len(listResp.Devices), 1)

	telemetryPayload := fmt.Sprintf(`{
        "timestamp": "%s",
        "readings": [
            {"sensor": "temperature", "value": 24.1}
        ]
    }`, time.Now().Format(time.RFC3339))
	require.NoError(t, dataService.ProcessTelemetry("integration-device-001", []byte(telemetryPayload)))
	time.Sleep(2 * time.Second)

	latestURL := fmt.Sprintf("/api/v1/devices/%d/data/latest?sensor_type=temperature", createdDevice.ID)
	w = doRequest(t, router, http.MethodGet, latestURL, nil, loginResp.Token)
	require.Equal(t, http.StatusOK, w.Code)

	var latestResp struct {
		Value float64 `json:"value"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &latestResp))
	require.InDelta(t, 24.1, latestResp.Value, 0.01)
}
