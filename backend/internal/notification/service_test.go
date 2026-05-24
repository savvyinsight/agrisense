package notification

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type mockChannelRepo struct {
	mock.Mock
}

func (m *mockChannelRepo) Create(ch *Channel) error {
	return m.Called(ch).Error(0)
}

func (m *mockChannelRepo) GetByID(id int) (*Channel, error) {
	args := m.Called(id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*Channel), args.Error(1)
}

func (m *mockChannelRepo) List() ([]Channel, error) {
	args := m.Called()
	return args.Get(0).([]Channel), args.Error(1)
}

func (m *mockChannelRepo) Update(id int, ch *Channel) error {
	return m.Called(id, ch).Error(0)
}

func (m *mockChannelRepo) Delete(id int) error {
	return m.Called(id).Error(0)
}

type mockRoutingRepo struct {
	mock.Mock
}

func (m *mockRoutingRepo) List() ([]RoutingRule, error) {
	args := m.Called()
	return args.Get(0).([]RoutingRule), args.Error(1)
}

func (m *mockRoutingRepo) Update(id int, rule *RoutingRule) error {
	return m.Called(id, rule).Error(0)
}

func (m *mockRoutingRepo) GetBySeverity(severity string) (*RoutingRule, error) {
	args := m.Called(severity)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*RoutingRule), args.Error(1)
}

func TestCreateChannel_Valid(t *testing.T) {
	channelRepo := new(mockChannelRepo)
	routingRepo := new(mockRoutingRepo)
	service := NewService(channelRepo, routingRepo)

	ch := &Channel{Type: "email", Name: "alerts@example.com", Enabled: true}
	channelRepo.On("Create", ch).Return(nil)

	err := service.CreateChannel(ch)
	assert.NoError(t, err)
	channelRepo.AssertExpectations(t)
}

func TestCreateChannel_MissingType(t *testing.T) {
	service := NewService(new(mockChannelRepo), new(mockRoutingRepo))

	err := service.CreateChannel(&Channel{Name: "test"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "channel type is required")
}

func TestCreateChannel_MissingName(t *testing.T) {
	service := NewService(new(mockChannelRepo), new(mockRoutingRepo))

	err := service.CreateChannel(&Channel{Type: "email"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "channel name is required")
}

func TestCreateChannel_InvalidType(t *testing.T) {
	service := NewService(new(mockChannelRepo), new(mockRoutingRepo))

	err := service.CreateChannel(&Channel{Type: "push", Name: "test"})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid channel type")
}

func TestGetSettings(t *testing.T) {
	channelRepo := new(mockChannelRepo)
	routingRepo := new(mockRoutingRepo)
	service := NewService(channelRepo, routingRepo)

	channels := []Channel{{ID: 1, Type: "email", Name: "test"}}
	rules := []RoutingRule{{ID: 1, Severity: "critical", ChannelIDs: []int{1}}}

	channelRepo.On("List").Return(channels, nil)
	routingRepo.On("List").Return(rules, nil)

	settings, err := service.GetSettings()
	assert.NoError(t, err)
	assert.Len(t, settings.Channels, 1)
	assert.Len(t, settings.RoutingRules, 1)
}

func TestTestChannel_Disabled(t *testing.T) {
	channelRepo := new(mockChannelRepo)
	service := NewService(channelRepo, new(mockRoutingRepo))

	ch := &Channel{ID: 1, Type: "email", Enabled: false}
	channelRepo.On("GetByID", 1).Return(ch, nil)

	err := service.TestChannel(1)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "channel is disabled")
}

func TestTestChannel_NotFound(t *testing.T) {
	channelRepo := new(mockChannelRepo)
	service := NewService(channelRepo, new(mockRoutingRepo))

	channelRepo.On("GetByID", 999).Return(nil, assert.AnError)

	err := service.TestChannel(999)
	assert.Error(t, err)
}

func TestUpdateRoutingRule(t *testing.T) {
	routingRepo := new(mockRoutingRepo)
	service := NewService(new(mockChannelRepo), routingRepo)

	rule := &RoutingRule{ChannelIDs: []int{1, 2}}
	routingRepo.On("Update", 1, rule).Return(nil)

	err := service.UpdateRoutingRule(1, rule)
	assert.NoError(t, err)
	routingRepo.AssertExpectations(t)
}
