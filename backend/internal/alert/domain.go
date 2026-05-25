package alert

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
	ID                      int            `json:"id"`
	Name                    string         `json:"name"`
	DeviceID                *int           `json:"device_id,omitempty"`        // nil = all devices
	FieldID                 *int           `json:"field_id,omitempty"`         // nil = all fields (if set, applies to all devices in the field)
	SensorTypeID            int            `json:"sensor_type_id"`
	Condition               AlertCondition `json:"condition"`
	ThresholdValue          *float64       `json:"threshold_value,omitempty"`
	ThresholdMax            *float64       `json:"threshold_max,omitempty"` // for between
	DurationSeconds         int            `json:"duration_seconds"`        // 0 = immediate
	Severity                AlertSeverity  `json:"severity"`
	Enabled                 bool           `json:"enabled"`
	UserID                  int            `json:"user_id"`
	AccountID               *int           `json:"account_id,omitempty"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	RecoveryThresholdValue  *float64       `json:"recovery_threshold_value,omitempty"`
	RecoveryCondition       *string        `json:"recovery_condition,omitempty"`
	TrendCondition          []byte         `json:"trend_condition,omitempty"`
	AutoEscalationEnabled   bool           `json:"auto_escalation_enabled"`
	AutoEscalationMinutes   *int           `json:"auto_escalation_minutes,omitempty"`
	AutoEscalationSeverity  *string        `json:"auto_escalation_severity,omitempty"`
}

type Alert struct {
	ID                  int                    `json:"id"`
	RuleID              int                    `json:"rule_id"`
	DeviceID            int                    `json:"-"`                              // internal DB id, not sent to frontend
	DeviceIDStr         string                 `json:"device_id"`                      // hardware device_id string
	DeviceName          string                 `json:"device_name,omitempty"`
	RuleName            string                 `json:"rule_name,omitempty"`
	FieldID             *int                   `json:"field_id,omitempty"`
	SensorValue         float64                `json:"sensor_value"`
	Message             string                 `json:"message"`
	Severity            AlertSeverity          `json:"severity"`
	Status              AlertStatus            `json:"status"`
	TriggeredAt         time.Time              `json:"triggered_at"`
	AcknowledgedAt      *time.Time             `json:"acknowledged_at,omitempty"`
	ResolvedAt          *time.Time             `json:"resolved_at,omitempty"`
	AccountID           *int                   `json:"account_id,omitempty"`
	Metadata            map[string]interface{} `json:"metadata,omitempty"`
	IsFlapping          bool                   `json:"is_flapping"`
	FlapCount           int                    `json:"flap_count"`
	SnoozedUntil        *time.Time             `json:"snoozed_until,omitempty"`
	SnoozeReason        *string                `json:"snooze_reason,omitempty"`
	CorrelationID       *string                `json:"correlation_id,omitempty"`
	RootCauseSuggestion *string                `json:"root_cause_suggestion,omitempty"`
}

type AlertCorrelation struct {
	CorrelationID       string  `json:"correlation_id"`
	RootCauseSuggestion *string `json:"root_cause_suggestion,omitempty"`
	AlertIDs            []int   `json:"alert_ids"`
	Count               int     `json:"count"`
}

type AlertRuleRepository interface {
	Create(rule *AlertRule) error
	GetByID(id int) (*AlertRule, error)
	GetByDeviceID(deviceID, accountID int) ([]AlertRule, error)
	GetEnabledRules(accountID int) ([]AlertRule, error)
	Update(rule *AlertRule) error
	Delete(id, accountID int) error
	List(accountID, userID int) ([]AlertRule, error)
	GetAutoEscalationRules() ([]AlertRule, error)
}

type AlertRepository interface {
	Create(alert *Alert) error
	GetByID(id int) (*Alert, error)
	GetActive(accountID int) ([]Alert, error)
	GetActivePaginated(accountID int, limit, offset int) ([]Alert, int64, error)
	GetByDeviceID(deviceID, accountID int) ([]Alert, error)
	GetByRuleID(ruleID int) ([]Alert, error)
	GetActiveByRuleAndDevice(ruleID, deviceID int) (*Alert, error)
	GetActiveAlertsByField(fieldID, accountID int) ([]Alert, error)
	Acknowledge(id, accountID int) error
	Resolve(id, accountID int) error
	ResolveByRuleID(ruleID int) ([]int, error)
	List(accountID int, limit, offset int) ([]Alert, int64, error)
	SnoozeAlert(id int, until time.Time, reason string) error
	UnsnoozeAlert(id int) error
	GetAlertCorrelations() ([]AlertCorrelation, error)
	UpdateFlapping(id int, isFlapping bool, flapCount int) error
	UpdateCorrelation(id int, correlationID string, rootCause *string) error
	GetRecentSnoozedByRuleAndDevice(ruleID, deviceID int) (*Alert, error)
	GetRecentByDeviceID(deviceID int, since time.Time) ([]Alert, error)
}
