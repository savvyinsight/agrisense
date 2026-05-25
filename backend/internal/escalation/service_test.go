package escalation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockEscalationRuleRepo struct {
	mock.Mock
}

func (m *mockEscalationRuleRepo) Create(rule *EscalationRule) error {
	return m.Called(rule).Error(0)
}

func (m *mockEscalationRuleRepo) GetByID(id int) (*EscalationRule, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*EscalationRule), args.Error(1)
}

func (m *mockEscalationRuleRepo) List(accountID int) ([]EscalationRule, error) {
	args := m.Called(accountID)
	return args.Get(0).([]EscalationRule), args.Error(1)
}

func (m *mockEscalationRuleRepo) GetEnabledByAccountID(accountID int) ([]EscalationRule, error) {
	args := m.Called(accountID)
	return args.Get(0).([]EscalationRule), args.Error(1)
}

func (m *mockEscalationRuleRepo) Update(id int, rule *EscalationRule) error {
	return m.Called(id, rule).Error(0)
}

func (m *mockEscalationRuleRepo) Delete(id int, accountID int) error {
	return m.Called(id, accountID).Error(0)
}

type mockEscalationHistoryRepo struct {
	mock.Mock
}

func (m *mockEscalationHistoryRepo) Create(entry *EscalationHistoryEntry) error {
	return m.Called(entry).Error(0)
}

func (m *mockEscalationHistoryRepo) GetByAlertID(alertID int) ([]EscalationHistoryEntry, error) {
	args := m.Called(alertID)
	return args.Get(0).([]EscalationHistoryEntry), args.Error(1)
}

func TestCreateRule_Valid(t *testing.T) {
	ruleRepo := new(mockEscalationRuleRepo)
	service := NewService(ruleRepo, new(mockEscalationHistoryRepo))

	rule := &EscalationRule{
		Name:            "Critical Alert Escalation",
		TriggerSeverity: "critical",
		Levels:          []EscalationLevel{{DelayMinutes: 15, Severity: "critical", ChannelIDs: []int{1}}},
		Enabled:         true,
	}
	ruleRepo.On("Create", rule).Return(nil)

	err := service.CreateRule(rule)
	assert.NoError(t, err)
	ruleRepo.AssertExpectations(t)
}

func TestCreateRule_MissingName(t *testing.T) {
	service := NewService(new(mockEscalationRuleRepo), new(mockEscalationHistoryRepo))

	err := service.CreateRule(&EscalationRule{
		TriggerSeverity: "critical",
		Levels:          []EscalationLevel{{DelayMinutes: 15}},
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "rule name is required")
}

func TestCreateRule_MissingSeverity(t *testing.T) {
	service := NewService(new(mockEscalationRuleRepo), new(mockEscalationHistoryRepo))

	err := service.CreateRule(&EscalationRule{
		Name:   "test",
		Levels: []EscalationLevel{{DelayMinutes: 15}},
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "trigger severity is required")
}

func TestCreateRule_NoLevels(t *testing.T) {
	service := NewService(new(mockEscalationRuleRepo), new(mockEscalationHistoryRepo))

	err := service.CreateRule(&EscalationRule{
		Name:            "test",
		TriggerSeverity: "critical",
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least one escalation level is required")
}

func TestListRules(t *testing.T) {
	ruleRepo := new(mockEscalationRuleRepo)
	service := NewService(ruleRepo, new(mockEscalationHistoryRepo))

	expected := []EscalationRule{
		{ID: 1, Name: "rule1", TriggerSeverity: "critical"},
		{ID: 2, Name: "rule2", TriggerSeverity: "warning"},
	}
	ruleRepo.On("List", 1).Return(expected, nil)

	rules, err := service.ListRules(1)
	assert.NoError(t, err)
	assert.Equal(t, expected, rules)
}

func TestUpdateRule_Valid(t *testing.T) {
	ruleRepo := new(mockEscalationRuleRepo)
	service := NewService(ruleRepo, new(mockEscalationHistoryRepo))

	rule := &EscalationRule{
		Name:            "updated",
		TriggerSeverity: "warning",
		Levels:          []EscalationLevel{{DelayMinutes: 30, Severity: "critical"}},
	}
	ruleRepo.On("Update", 1, rule).Return(nil)

	err := service.UpdateRule(1, rule)
	assert.NoError(t, err)
	ruleRepo.AssertExpectations(t)
}

func TestDeleteRule(t *testing.T) {
	ruleRepo := new(mockEscalationRuleRepo)
	service := NewService(ruleRepo, new(mockEscalationHistoryRepo))

	ruleRepo.On("Delete", 1, 1).Return(nil)

	err := service.DeleteRule(1, 1)
	assert.NoError(t, err)
	ruleRepo.AssertExpectations(t)
}

func TestGetHistory(t *testing.T) {
	historyRepo := new(mockEscalationHistoryRepo)
	service := NewService(new(mockEscalationRuleRepo), historyRepo)

	expected := []EscalationHistoryEntry{
		{ID: 1, AlertID: 5, RuleID: 1, LevelOrder: 1},
	}
	historyRepo.On("GetByAlertID", 5).Return(expected, nil)

	history, err := service.GetHistory(5)
	assert.NoError(t, err)
	assert.Equal(t, expected, history)
}
