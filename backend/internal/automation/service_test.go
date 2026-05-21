package automation

import (
	"errors"
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/control"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/stretchr/testify/assert"
)

type fakeAutomationRuleRepo struct {
	createFunc             func(rule *AutomationRule) error
	getByIDFunc            func(id int) (*AutomationRule, error)
	getByUserIDFunc        func(userID int) ([]AutomationRule, error)
	getEnabledRulesFunc    func() ([]AutomationRule, error)
	updateFunc             func(rule *AutomationRule) error
	deleteFunc             func(id int) error
	getByTargetDeviceIDFunc func(deviceID int) ([]AutomationRule, error)
}

func (f *fakeAutomationRuleRepo) Create(rule *AutomationRule) error {
	if f.createFunc != nil {
		return f.createFunc(rule)
	}
	return nil
}

func (f *fakeAutomationRuleRepo) GetByID(id int) (*AutomationRule, error) {
	if f.getByIDFunc != nil {
		return f.getByIDFunc(id)
	}
	return nil, errors.New("not found")
}

func (f *fakeAutomationRuleRepo) GetByUserID(userID int) ([]AutomationRule, error) {
	if f.getByUserIDFunc != nil {
		return f.getByUserIDFunc(userID)
	}
	return nil, nil
}

func (f *fakeAutomationRuleRepo) GetEnabledRules() ([]AutomationRule, error) {
	if f.getEnabledRulesFunc != nil {
		return f.getEnabledRulesFunc()
	}
	return nil, nil
}

func (f *fakeAutomationRuleRepo) Update(rule *AutomationRule) error {
	if f.updateFunc != nil {
		return f.updateFunc(rule)
	}
	return nil
}

func (f *fakeAutomationRuleRepo) Delete(id int) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(id)
	}
	return nil
}

func (f *fakeAutomationRuleRepo) GetByTargetDeviceID(deviceID int) ([]AutomationRule, error) {
	if f.getByTargetDeviceIDFunc != nil {
		return f.getByTargetDeviceIDFunc(deviceID)
	}
	return nil, nil
}

type fakeDeviceRepo struct {
	getByIDFunc func(id int) (*device.Device, error)
}

func (f *fakeDeviceRepo) Create(device *device.Device) error { return nil }
func (f *fakeDeviceRepo) GetByID(id int) (*device.Device, error) {
	if f.getByIDFunc != nil {
		return f.getByIDFunc(id)
	}
	return nil, errors.New("not found")
}
func (f *fakeDeviceRepo) GetByDeviceID(deviceID string) (*device.Device, error) { return nil, nil }
func (f *fakeDeviceRepo) GetByUserID(userID int) ([]device.Device, error)      { return nil, nil }
func (f *fakeDeviceRepo) Update(device *device.Device) error                    { return nil }
func (f *fakeDeviceRepo) UpdateStatus(deviceID string, status device.DeviceStatus) error { return nil }
func (f *fakeDeviceRepo) UpdateHeartbeat(deviceID string) error                 { return nil }
func (f *fakeDeviceRepo) Delete(id int) error                                   { return nil }
func (f *fakeDeviceRepo) List(userID int, limit, offset int) ([]device.Device, int64, error) {
	return nil, 0, nil
}
func (f *fakeDeviceRepo) FindOrCreate(deviceID string) (*device.Device, error) { return nil, nil }
func (f *fakeDeviceRepo) ClaimDevice(deviceID string, userID, accountID int) error { return nil }
func (f *fakeDeviceRepo) UnclaimDevice(deviceID string) error                   { return nil }

type fakeCommandExecutor struct {
	executeFunc func(deviceID int, command string, parameters map[string]interface{}, userID *int) (*control.Command, error)
}

func (f *fakeCommandExecutor) ExecuteCommand(deviceID int, command string, parameters map[string]interface{}, userID *int) (*control.Command, error) {
	if f.executeFunc != nil {
		return f.executeFunc(deviceID, command, parameters, userID)
	}
	return &control.Command{ID: 1}, nil
}

func sensorVal(v float64) *float64 {
	return &v
}

func intPtr(i int) *int {
	return &i
}

func strPtr(s string) *string {
	return &s
}

func TestEvaluateSensorRule_GT(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "test-gt", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerCondition: AutomationConditionGT, TriggerValue: sensorVal(30),
		ActionCommand: "turn_on", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(deviceID int, command string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			assert.Equal(t, 10, deviceID)
			assert.Equal(t, "turn_on", command)
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "temperature", Value: 35})
	assert.True(t, executed, "rule should have been executed")
}

func TestEvaluateSensorRule_LT(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "test-lt", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(2),
		TriggerCondition: AutomationConditionLT, TriggerValue: sensorVal(50),
		ActionCommand: "turn_off", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "humidity", Value: 30})
	assert.True(t, executed)
}

func TestEvaluateSensorRule_EQ(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "test-eq", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(3),
		TriggerCondition: AutomationConditionEQ, TriggerValue: sensorVal(25),
		ActionCommand: "set_power", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "soil_moisture", Value: 25})
	assert.True(t, executed)
}

func TestEvaluateSensorRule_GTE(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "test-gte", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(4),
		TriggerCondition: AutomationConditionGTE, TriggerValue: sensorVal(100),
		ActionCommand: "turn_on", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "light_intensity", Value: 100})
	assert.True(t, executed)
}

func TestEvaluateSensorRule_LTE(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "test-lte", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerCondition: AutomationConditionLTE, TriggerValue: sensorVal(0),
		ActionCommand: "turn_off", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "temperature", Value: -5})
	assert.True(t, executed)
}

func TestEvaluateSensorRule_NoMatch_WrongSensorType(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "temp-only", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerCondition: AutomationConditionGT, TriggerValue: sensorVal(30),
		ActionCommand: "turn_on", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	// humidity should not match temperature rule
	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "humidity", Value: 35})
	assert.False(t, executed)
}

func TestEvaluateSensorRule_NoMatch_Condition(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "gt-30", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerCondition: AutomationConditionGT, TriggerValue: sensorVal(30),
		ActionCommand: "turn_on", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	// Value 25 is NOT > 30
	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "temperature", Value: 25})
	assert.False(t, executed)
}

func TestEvaluateSensorRule_ScheduleRule_Ignored(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	s.scheduler.rules[1] = &AutomationRule{
		ID: 1, Name: "scheduled-only", TargetDeviceID: 10,
		TriggerType: TriggerTypeSchedule,
		ScheduleCron: strPtr("*/5 * * * *"),
		ActionCommand: "turn_on", UserID: 1,
	}

	executed := false
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			executed = true
			return &control.Command{ID: 1}, nil
		},
	}

	s.EvaluateSensorRule(&sensor.SensorData{SensorType: "temperature", Value: 35})
	assert.False(t, executed, "schedule rules should be ignored by sensor evaluation")
}

func TestCreateRule_Valid(t *testing.T) {
	deviceRepo := &fakeDeviceRepo{
		getByIDFunc: func(id int) (*device.Device, error) {
			return &device.Device{ID: id}, nil
		},
	}

	created := false
	repo := fakeAutomationRuleRepo{
		createFunc: func(rule *AutomationRule) error {
			created = true
			rule.ID = 1
			return nil
		},
	}

	s := NewService(&repo, deviceRepo, &fakeCommandExecutor{})
	err := s.CreateRule(&AutomationRule{
		Name: "test", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerValue: sensorVal(30), TriggerCondition: AutomationConditionGT,
		ActionCommand: "turn_on", Enabled: true, UserID: 1,
	})

	assert.NoError(t, err)
	assert.True(t, created)
}

func TestCreateRule_ValidationError_MissingName(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	err := s.CreateRule(&AutomationRule{
		TargetDeviceID: 10, TriggerType: TriggerTypeSensor,
		TriggerSensorTypeID: intPtr(1), TriggerValue: sensorVal(30),
		ActionCommand: "turn_on", UserID: 1,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "name is required")
}

func TestCreateRule_ValidationError_MissingDevice(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)
	err := s.CreateRule(&AutomationRule{
		Name: "test", TriggerType: TriggerTypeSensor,
		TriggerSensorTypeID: intPtr(1), TriggerValue: sensorVal(30),
		ActionCommand: "turn_on", UserID: 1,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "target device ID is required")
}

func TestCreateRule_ValidationError_DeviceNotFound(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{}, // getByIDFunc returns "not found" by default
		&fakeCommandExecutor{},
	)
	err := s.CreateRule(&AutomationRule{
		Name: "test", TargetDeviceID: 999,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerValue: sensorVal(30), ActionCommand: "turn_on", UserID: 1,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "target device not found")
}

func TestCreateRule_ValidationError_InvalidTriggerType(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{getByIDFunc: func(id int) (*device.Device, error) {
			return &device.Device{ID: id}, nil
		}},
		&fakeCommandExecutor{},
	)
	err := s.CreateRule(&AutomationRule{
		Name: "test", TargetDeviceID: 10,
		TriggerType: "invalid", ActionCommand: "turn_on", UserID: 1,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid trigger type")
}

func TestCreateRule_Schedule_MissingCron(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{getByIDFunc: func(id int) (*device.Device, error) {
			return &device.Device{ID: id}, nil
		}},
		&fakeCommandExecutor{},
	)
	err := s.CreateRule(&AutomationRule{
		Name: "test", TargetDeviceID: 10,
		TriggerType: TriggerTypeSchedule, ActionCommand: "turn_on", UserID: 1,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "schedule cron is required")
}

func TestGetRulesByUser(t *testing.T) {
	expectedRules := []AutomationRule{
		{ID: 1, Name: "rule1"},
		{ID: 2, Name: "rule2"},
	}
	repo := fakeAutomationRuleRepo{
		getByUserIDFunc: func(userID int) ([]AutomationRule, error) {
			assert.Equal(t, 42, userID)
			return expectedRules, nil
		},
	}

	s := NewService(&repo, &fakeDeviceRepo{}, &fakeCommandExecutor{})
	rules, err := s.GetRulesByUser(42)

	assert.NoError(t, err)
	assert.Equal(t, expectedRules, rules)
}

func TestGetRuleByID(t *testing.T) {
	expected := &AutomationRule{ID: 5, Name: "found"}
	repo := fakeAutomationRuleRepo{
		getByIDFunc: func(id int) (*AutomationRule, error) {
			assert.Equal(t, 5, id)
			return expected, nil
		},
	}

	s := NewService(&repo, &fakeDeviceRepo{}, &fakeCommandExecutor{})
	rule, err := s.GetRuleByID(5)

	assert.NoError(t, err)
	assert.Equal(t, expected, rule)
}

func TestExecuteAutomationRule_DedupCooldown(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)

	execCount := 0
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			execCount++
			return &control.Command{ID: 1}, nil
		},
	}

	rule := &AutomationRule{
		ID: 1, Name: "dedup-test", TargetDeviceID: 10,
		TriggerDurationSeconds: 300, // 5 min cooldown
		ActionCommand: "turn_on", UserID: 1,
	}

	// First execution should succeed
	s.executeAutomationRule(rule, nil)
	assert.Equal(t, 1, execCount)

	// Second execution within cooldown should be skipped
	s.executeAutomationRule(rule, nil)
	assert.Equal(t, 1, execCount, "should be deduped")
}

func TestExecuteAutomationRule_DedupExpired(t *testing.T) {
	s := NewService(
		&fakeAutomationRuleRepo{},
		&fakeDeviceRepo{},
		&fakeCommandExecutor{},
	)

	execCount := 0
	s.commandService = &fakeCommandExecutor{
		executeFunc: func(_ int, _ string, _ map[string]interface{}, _ *int) (*control.Command, error) {
			execCount++
			return &control.Command{ID: 1}, nil
		},
	}

	rule := &AutomationRule{
		ID: 1, Name: "dedup-expired", TargetDeviceID: 10,
		TriggerDurationSeconds: 1, // 1 second cooldown
		ActionCommand: "turn_on", UserID: 1,
	}

	s.executeAutomationRule(rule, nil)
	assert.Equal(t, 1, execCount)

	// Wait for cooldown to expire
	time.Sleep(1100 * time.Millisecond)

	s.executeAutomationRule(rule, nil)
	assert.Equal(t, 2, execCount, "should execute after cooldown expires")
}

func TestUpdateRule(t *testing.T) {
	updated := false
	repo := fakeAutomationRuleRepo{
		updateFunc: func(rule *AutomationRule) error {
			updated = true
			return nil
		},
		getEnabledRulesFunc: func() ([]AutomationRule, error) {
			return nil, nil
		},
	}

	s := NewService(&repo, &fakeDeviceRepo{getByIDFunc: func(id int) (*device.Device, error) {
		return &device.Device{ID: id}, nil
	}}, &fakeCommandExecutor{})

	err := s.UpdateRule(&AutomationRule{
		ID: 1, Name: "updated", TargetDeviceID: 10,
		TriggerType: TriggerTypeSensor, TriggerSensorTypeID: intPtr(1),
		TriggerValue: sensorVal(30), TriggerCondition: AutomationConditionGT,
		ActionCommand: "turn_on", UserID: 1,
	})

	assert.NoError(t, err)
	assert.True(t, updated)
}

func TestDeleteRule(t *testing.T) {
	deleted := false
	repo := fakeAutomationRuleRepo{
		deleteFunc: func(id int) error {
			deleted = true
			assert.Equal(t, 1, id)
			return nil
		},
		getEnabledRulesFunc: func() ([]AutomationRule, error) {
			return nil, nil
		},
	}

	s := NewService(&repo, &fakeDeviceRepo{}, &fakeCommandExecutor{})
	err := s.DeleteRule(1)

	assert.NoError(t, err)
	assert.True(t, deleted)
}
