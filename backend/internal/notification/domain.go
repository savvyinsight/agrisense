package notification

import (
	"encoding/json"
	"time"
)

type Channel struct {
	ID        int             `json:"id"`
	Type      string          `json:"type"` // email, sms, webhook
	Name      string          `json:"name"`
	Config    json.RawMessage `json:"config"`
	Enabled   bool            `json:"enabled"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type RoutingRule struct {
	ID         int       `json:"id"`
	Severity   string    `json:"severity"`
	ChannelIDs []int     `json:"channel_ids"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type NotificationSettings struct {
	Channels     []Channel     `json:"channels"`
	RoutingRules []RoutingRule `json:"routing_rules"`
}

type ChannelRepository interface {
	Create(ch *Channel) error
	GetByID(id int) (*Channel, error)
	List() ([]Channel, error)
	Update(id int, ch *Channel) error
	Delete(id int) error
}

type RoutingRuleRepository interface {
	List() ([]RoutingRule, error)
	Update(id int, rule *RoutingRule) error
	GetBySeverity(severity string) (*RoutingRule, error)
}
