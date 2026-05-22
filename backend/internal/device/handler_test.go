package device

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockDeviceRepo struct {
	mock.Mock
}

func (m *mockDeviceRepo) Create(device *Device) error {
	return m.Called(device).Error(0)
}

func (m *mockDeviceRepo) GetByID(id int) (*Device, error) {
	args := m.Called(id)
	return args.Get(0).(*Device), args.Error(1)
}

func (m *mockDeviceRepo) GetByDeviceID(deviceID string) (*Device, error) {
	return nil, nil
}

func (m *mockDeviceRepo) GetByUserID(userID int) ([]Device, error) {
	args := m.Called(userID)
	return args.Get(0).([]Device), args.Error(1)
}

func (m *mockDeviceRepo) Update(device *Device) error {
	return m.Called(device).Error(0)
}

func (m *mockDeviceRepo) UpdateStatus(deviceID string, status DeviceStatus) error {
	return nil
}

func (m *mockDeviceRepo) UpdateHeartbeat(deviceID string) error {
	return nil
}

func (m *mockDeviceRepo) Delete(id int) error {
	return m.Called(id).Error(0)
}

func (m *mockDeviceRepo) List(userID int, filter DeviceFilter, limit, offset int) ([]Device, int64, error) {
	args := m.Called(userID, filter, limit, offset)
	return args.Get(0).([]Device), args.Get(1).(int64), args.Error(2)
}
func (m *mockDeviceRepo) FindOrCreate(deviceID string) (*Device, error) {
	args := m.Called(deviceID)
	if d, ok := args.Get(0).(*Device); ok {
		return d, args.Error(1)
	}
	return nil, args.Error(1)
}
func (m *mockDeviceRepo) ClaimDevice(deviceID string, userID, accountID int) error {
	args := m.Called(deviceID, userID, accountID)
	return args.Error(0)
}
func (m *mockDeviceRepo) UnclaimDevice(deviceID string) error {
	args := m.Called(deviceID)
	return args.Error(0)
}

func TestCreate_SetsOfflineStatusAndReturnsCreatedDevice(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := new(mockDeviceRepo)
	handler := NewDeviceHandler(repo)

	requestBody := `{"device_id":"device-123","name":"Field Sensor","type":"sensor"}`
	req := httptest.NewRequest(http.MethodPost, "/devices", strings.NewReader(requestBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("user_id", 42)

	repo.On("Create", mock.AnythingOfType("*device.Device")).Return(nil).Run(func(args mock.Arguments) {
		dev := args.Get(0).(*Device)
		dev.ID = 1
		dev.CreatedAt = time.Now()
		dev.UpdatedAt = time.Now()
	})

	handler.Create(c)

	assert.Equal(t, http.StatusCreated, w.Code)

	var created Device
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &created))
	assert.Equal(t, "device-123", created.DeviceID)
	assert.Equal(t, DeviceStatusOffline, created.Status)
	assert.Equal(t, 42, *created.UserID)
	repo.AssertExpectations(t)
}

func TestList_ReturnsPaginatedDevices(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := new(mockDeviceRepo)
	handler := NewDeviceHandler(repo)

	uid5 := 5
	devices := []Device{{ID: 1, DeviceID: "device-abc", Name: "Sensor", Type: DeviceTypeSensor, Status: DeviceStatusOffline, UserID: &uid5}}
	repo.On("List", 5, DeviceFilter{}, 20, 0).Return(devices, int64(1), nil)

	req := httptest.NewRequest(http.MethodGet, "/devices", nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	c.Set("user_id", 5)

	handler.List(c)

	assert.Equal(t, http.StatusOK, w.Code)

	var response struct {
		Devices []Device `json:"devices"`
		Total   int64    `json:"total"`
		Page    int      `json:"page"`
		Limit   int      `json:"limit"`
	}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	assert.Len(t, response.Devices, 1)
	assert.Equal(t, int64(1), response.Total)
	assert.Equal(t, 1, response.Page)
	assert.Equal(t, 20, response.Limit)
	repo.AssertExpectations(t)
}
