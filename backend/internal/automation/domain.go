package automation

import (
	"time"
)

type AutomationTriggerType string
type AutomationCondition string

const (
	TriggerTypeSensor   AutomationTriggerType = "sensor"
	TriggerTypeSchedule AutomationTriggerType = "schedule"

	AutomationConditionGT  AutomationCondition = ">"
	AutomationConditionLT  AutomationCondition = "<"
	AutomationConditionEQ  AutomationCondition = "="
	AutomationConditionGTE AutomationCondition = ">="
	AutomationConditionLTE AutomationCondition = "<="
)

type AutomationRule struct {
	ID                     int                    `json:"id"`
	Name                   string                 `json:"name"`
	TargetDeviceID         int                    `json:"target_device_id"`
	TriggerType            AutomationTriggerType  `json:"trigger_type"`
	TriggerSensorTypeID    *int                   `json:"trigger_sensor_type_id,omitempty"`
	TriggerCondition       AutomationCondition    `json:"trigger_condition,omitempty"`
	TriggerValue           *float64               `json:"trigger_value,omitempty"`
	TriggerDurationSeconds int                    `json:"trigger_duration_seconds,omitempty"`
	ScheduleCron           *string                `json:"schedule_cron,omitempty"`
	Timezone               string                 `json:"timezone"`
	ActionCommand          string                 `json:"action_command"`
	ActionParameters       map[string]interface{} `json:"action_parameters,omitempty"`
	Enabled                bool                   `json:"enabled"`
	UserID                 int                    `json:"user_id"`
	CreatedAt              time.Time              `json:"created_at"`
	UpdatedAt              time.Time              `json:"updated_at"`
	Paused                 bool                   `json:"paused"`
	LastTriggeredAt        *time.Time             `json:"last_triggered_at,omitempty"`
	ExecutionCount         int                    `json:"execution_count"`
	LastCommandStatus      *string                `json:"last_command_status,omitempty"`
	Metadata               map[string]interface{} `json:"metadata,omitempty"`
}

type AutomationRuleRepository interface {
	Create(rule *AutomationRule) error
	GetByID(id int) (*AutomationRule, error)
	GetByUserID(userID int) ([]AutomationRule, error)
	GetEnabledRules() ([]AutomationRule, error)
	Update(rule *AutomationRule) error
	Delete(id int) error
	GetByTargetDeviceID(deviceID int) ([]AutomationRule, error)
	UpdatePartial(id int, updates map[string]interface{}) error
	IncrementExecutionCount(id int) error
	UpdateLastTriggered(id int) error
	UpdateLastCommandStatus(id int, status string) error
	GetGlobalAutomationEnabled() (bool, error)
	SetGlobalAutomationEnabled(enabled bool) error
	GetCommandHistory(ruleID int, limit int) ([]map[string]interface{}, error)
}
