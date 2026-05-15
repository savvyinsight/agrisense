package irrigation

import "time"

type ZoneStatus string

const (
	ZoneStatusActive    ZoneStatus = "active"
	ZoneStatusScheduled ZoneStatus = "scheduled"
	ZoneStatusIdle      ZoneStatus = "idle"
	ZoneStatusFailed    ZoneStatus = "failed"
)

type IrrigationZone struct {
	ID             int        `json:"id"`
	Name           string     `json:"name"`
	FieldID        int        `json:"field_id"`
	Moisture       float64    `json:"moisture"`
	TargetMoisture float64    `json:"target_moisture"`
	Status         ZoneStatus `json:"status"`
	RuntimeMinutes int        `json:"runtime_minutes"`
	FlowRateLPM    float64    `json:"flow_rate_lpm"`
	Latitude       *float64   `json:"latitude,omitempty"`
	Longitude      *float64   `json:"longitude,omitempty"`
	UserID         int        `json:"user_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type IrrigationZoneRepository interface {
	ListByFieldID(fieldID int, userID int) ([]IrrigationZone, error)
	GetByID(id int) (*IrrigationZone, error)
	UpdateStatus(id int, status ZoneStatus) error
}
