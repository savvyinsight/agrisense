package escalation

import (
	"encoding/json"
	"time"
)

type EscalationRule struct {
	ID              int               `json:"id"`
	Name            string            `json:"name"`
	TriggerSeverity string            `json:"trigger_severity"`
	Levels          []EscalationLevel `json:"levels"`
	Enabled         bool              `json:"enabled"`
	AccountID       *int              `json:"account_id,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type EscalationLevel struct {
	ID           int   `json:"id"`
	RuleID       int   `json:"rule_id"`
	LevelOrder   int   `json:"level_order"`
	DelayMinutes int   `json:"delay_minutes"`
	Severity     string `json:"severity"`
	ChannelIDs   []int `json:"channel_ids"`
}

type EscalationHistoryEntry struct {
	ID                 int              `json:"id"`
	AlertID            int              `json:"alert_id"`
	RuleID             int              `json:"rule_id"`
	LevelOrder         int              `json:"level_order"`
	EscalatedAt        time.Time        `json:"escalated_at"`
	ChannelIDs         []int            `json:"channel_ids"`
	NotificationStatus json.RawMessage  `json:"notification_status"`
}

type EscalationRuleRepository interface {
	Create(rule *EscalationRule) error
	GetByID(id int) (*EscalationRule, error)
	List(accountID int) ([]EscalationRule, error)
	GetEnabledByAccountID(accountID int) ([]EscalationRule, error)
	Update(id int, rule *EscalationRule) error
	Delete(id int, accountID int) error
}

type EscalationHistoryRepository interface {
	Create(entry *EscalationHistoryEntry) error
	GetByAlertID(alertID int) ([]EscalationHistoryEntry, error)
}
