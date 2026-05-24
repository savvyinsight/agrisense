package alert

import (
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockAlertRepo struct {
	mock.Mock
}

func (m *mockAlertRepo) Create(alert *Alert) error {
	return m.Called(alert).Error(0)
}

func (m *mockAlertRepo) GetByID(id int) (*Alert, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Alert), args.Error(1)
}

func (m *mockAlertRepo) GetActive(accountID int) ([]Alert, error) {
	args := m.Called(accountID)
	return args.Get(0).([]Alert), args.Error(1)
}

func (m *mockAlertRepo) GetActivePaginated(accountID int, limit, offset int) ([]Alert, int64, error) {
	args := m.Called(accountID, limit, offset)
	return args.Get(0).([]Alert), args.Get(1).(int64), args.Error(2)
}

func (m *mockAlertRepo) GetByDeviceID(deviceID, accountID int) ([]Alert, error) {
	args := m.Called(deviceID, accountID)
	return args.Get(0).([]Alert), args.Error(1)
}

func (m *mockAlertRepo) GetByRuleID(ruleID int) ([]Alert, error) {
	return nil, nil
}

func (m *mockAlertRepo) GetActiveByRuleAndDevice(ruleID, deviceID int) (*Alert, error) {
	return nil, nil
}

func (m *mockAlertRepo) GetActiveAlertsByField(fieldID, accountID int) ([]Alert, error) {
	return nil, nil
}

func (m *mockAlertRepo) Acknowledge(id, accountID int) error {
	return m.Called(id, accountID).Error(0)
}

func (m *mockAlertRepo) Resolve(id, accountID int) error {
	return m.Called(id, accountID).Error(0)
}

func (m *mockAlertRepo) ResolveByRuleID(ruleID int) ([]int, error) {
	args := m.Called(ruleID)
	return args.Get(0).([]int), args.Error(1)
}

func (m *mockAlertRepo) List(accountID int, limit, offset int) ([]Alert, int64, error) {
	args := m.Called(accountID, limit, offset)
	return args.Get(0).([]Alert), args.Get(1).(int64), args.Error(2)
}

func (m *mockAlertRepo) SnoozeAlert(id int, until time.Time, reason string) error {
	return m.Called(id, until, reason).Error(0)
}

func (m *mockAlertRepo) UnsnoozeAlert(id int) error {
	return m.Called(id).Error(0)
}

func (m *mockAlertRepo) GetAlertCorrelations() ([]AlertCorrelation, error) {
	args := m.Called()
	return args.Get(0).([]AlertCorrelation), args.Error(1)
}

func (m *mockAlertRepo) UpdateFlapping(id int, isFlapping bool, flapCount int) error {
	return m.Called(id, isFlapping, flapCount).Error(0)
}

func (m *mockAlertRepo) UpdateCorrelation(id int, correlationID string, rootCause *string) error {
	return m.Called(id, correlationID, rootCause).Error(0)
}

type mockRuleRepo struct {
	mock.Mock
}

func (m *mockRuleRepo) Create(rule *AlertRule) error {
	return m.Called(rule).Error(0)
}

func (m *mockRuleRepo) GetByID(id int) (*AlertRule, error) {
	args := m.Called(id)
	return args.Get(0).(*AlertRule), args.Error(1)
}

func (m *mockRuleRepo) GetByDeviceID(deviceID, accountID int) ([]AlertRule, error) {
	args := m.Called(deviceID, accountID)
	return args.Get(0).([]AlertRule), args.Error(1)
}

func (m *mockRuleRepo) GetEnabledRules(accountID int) ([]AlertRule, error) {
	args := m.Called(accountID)
	return args.Get(0).([]AlertRule), args.Error(1)
}

func (m *mockRuleRepo) Update(rule *AlertRule) error {
	return m.Called(rule).Error(0)
}

func (m *mockRuleRepo) Delete(id, accountID int) error {
	return m.Called(id, accountID).Error(0)
}

func (m *mockRuleRepo) List(accountID, userID int) ([]AlertRule, error) {
	args := m.Called(accountID, userID)
	return args.Get(0).([]AlertRule), args.Error(1)
}

func (m *mockRuleRepo) GetAutoEscalationRules() ([]AlertRule, error) {
	args := m.Called()
	return args.Get(0).([]AlertRule), args.Error(1)
}

type mockDeviceRepo struct {
	mock.Mock
}

func (m *mockDeviceRepo) Create(device *device.Device) error { return nil }
func (m *mockDeviceRepo) GetByID(id int) (*device.Device, error) { return nil, nil }
func (m *mockDeviceRepo) GetByDeviceID(deviceID string) (*device.Device, error) { return nil, nil }
func (m *mockDeviceRepo) GetByUserID(userID int) ([]device.Device, error) { return nil, nil }
func (m *mockDeviceRepo) Update(device *device.Device) error { return nil }
func (m *mockDeviceRepo) UpdateStatus(deviceID string, status device.DeviceStatus) error { return nil }
func (m *mockDeviceRepo) UpdateHeartbeat(deviceID string) error { return nil }
func (m *mockDeviceRepo) Delete(id, accountID int) error { return nil }
func (m *mockDeviceRepo) List(accountID, userID int, filter device.DeviceFilter, limit, offset int) ([]device.Device, int64, error) { return nil, 0, nil }
func (m *mockDeviceRepo) FindOrCreate(deviceID string) (*device.Device, error) { return nil, nil }
func (m *mockDeviceRepo) ClaimDevice(deviceID string, userID, accountID int) error { return nil }
func (m *mockDeviceRepo) UnclaimDevice(deviceID string) error { return nil }

type mockFieldRepo struct {
	mock.Mock
}

func (m *mockFieldRepo) Create(f *field.Field) error { return nil }
func (m *mockFieldRepo) GetByID(id int) (*field.Field, error) { return nil, nil }
func (m *mockFieldRepo) List(userID int) ([]field.Field, error) { return nil, nil }
func (m *mockFieldRepo) Update(f *field.Field) error { return nil }
func (m *mockFieldRepo) Delete(id int) error { return nil }
func (m *mockFieldRepo) UpdateSensorData(fieldID int, moisture, temperature, humidity float64) error { return nil }
func (m *mockFieldRepo) UpdateHealth(fieldID int, health field.FieldHealth) error { return nil }

func TestCreateRule_ForwardsToRuleRepo(t *testing.T) {
	rule := &AlertRule{Name: "High humidity", UserID: 10}
	ruleRepo := new(mockRuleRepo)
	service := NewService(nil, ruleRepo, &mockDeviceRepo{}, &mockFieldRepo{})

	ruleRepo.On("Create", rule).Return(nil)

	err := service.CreateRule(rule)

	assert.NoError(t, err)
	ruleRepo.AssertExpectations(t)
}

func TestGetActiveAlertsPaginated_CalculatesOffset(t *testing.T) {
	alertRepo := new(mockAlertRepo)
	service := NewService(alertRepo, nil, &mockDeviceRepo{}, &mockFieldRepo{})

	alerts := []Alert{{ID: 1}}
	alertRepo.On("GetActivePaginated", 1, 5, 10).Return(alerts, int64(42), nil)

	result, total, err := service.GetActiveAlertsPaginated(1, 3, 5)

	assert.NoError(t, err)
	assert.Equal(t, alerts, result)
	assert.Equal(t, int64(42), total)
	alertRepo.AssertExpectations(t)
}
