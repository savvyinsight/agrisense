package domain

import (
	"time"
)

type CommandStatus string

const (
	CommandStatusPending   CommandStatus = "pending"
	CommandStatusSent      CommandStatus = "sent"
	CommandStatusDelivered CommandStatus = "delivered"
	CommandStatusExecuted  CommandStatus = "executed"
	CommandStatusFailed    CommandStatus = "failed"
)

type Command struct {
	ID          int                    `json:"id"`
	DeviceID    int                    `json:"device_id"`
	Command     string                 `json:"command"` // turn_on, turn_off, set_value
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	Status      CommandStatus          `json:"status"`
	CreatedAt   time.Time              `json:"created_at"`
	SentAt      *time.Time             `json:"sent_at,omitempty"`
	DeliveredAt *time.Time             `json:"delivered_at,omitempty"`
	ExecutedAt  *time.Time             `json:"executed_at,omitempty"`
	UserID      *int                   `json:"user_id,omitempty"` // nil = auto/rule
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

type CommandRepository interface {
	Create(cmd *Command) error
	GetByID(id int) (*Command, error)
	GetByDeviceID(deviceID int, limit int) ([]Command, error)
	UpdateStatus(id int, status CommandStatus) error
	UpdateDelivery(id int, sentAt, deliveredAt, executedAt *time.Time) error
	GetPending(deviceID int) ([]Command, error)
}
