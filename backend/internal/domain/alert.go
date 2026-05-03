package domain

import (
	"time"
)

type AlertCondition string
type AlertSeverity string
type AlertStatus string

const (
	ConditionGT      AlertCondition = ">"
	ConditionLT      AlertCondition = "<"
	ConditionEQ      AlertCondition = "="
	ConditionGTE     AlertCondition = ">="
	ConditionLTE     AlertCondition = "<="
	ConditionBetween AlertCondition = "between"

	SeverityInfo     AlertSeverity = "info"
	SeverityWarning  AlertSeverity = "warning"
	SeverityCritical AlertSeverity = "critical"

	AlertStatusTriggered    AlertStatus = "triggered"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved     AlertStatus = "resolved"
)

type AlertRule struct {
	ID              int            `json:"id"`
	Name            string         `json:"name"`
	DeviceID        *int           `json:"device_id,omitempty"` // nil = all devices
	SensorTypeID    int            `json:"sensor_type_id"`
	Condition       AlertCondition `json:"condition"`
	ThresholdValue  *float64       `json:"threshold_value,omitempty"`
	ThresholdMax    *float64       `json:"threshold_max,omitempty"` // for between
	DurationSeconds int            `json:"duration_seconds"`        // 0 = immediate
	Severity        AlertSeverity  `json:"severity"`
	Enabled         bool           `json:"enabled"`
	UserID          int            `json:"user_id"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

type Alert struct {
	ID             int                    `json:"id"`
	RuleID         int                    `json:"rule_id"`
	DeviceID       int                    `json:"device_id"`
	SensorValue    float64                `json:"sensor_value"`
	Message        string                 `json:"message"`
	Severity       AlertSeverity          `json:"severity"`
	Status         AlertStatus            `json:"status"`
	TriggeredAt    time.Time              `json:"triggered_at"`
	AcknowledgedAt *time.Time             `json:"acknowledged_at,omitempty"`
	ResolvedAt     *time.Time             `json:"resolved_at,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

type AlertRuleRepository interface {
	Create(rule *AlertRule) error
	GetByID(id int) (*AlertRule, error)
	GetByDeviceID(deviceID int) ([]AlertRule, error)
	GetEnabledRules() ([]AlertRule, error)
	Update(rule *AlertRule) error
	Delete(id int) error
	List(userID int) ([]AlertRule, error)
}

type AlertRepository interface {
	Create(alert *Alert) error
	GetActive() ([]Alert, error)
	GetActivePaginated(limit, offset int) ([]Alert, int64, error)
	GetByDeviceID(deviceID int) ([]Alert, error)
	GetByRuleID(ruleID int) ([]Alert, error)
	Acknowledge(id int) error
	Resolve(id int) error
	List(limit, offset int) ([]Alert, int64, error)
}
