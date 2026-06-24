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
	DeviceID       *int       `json:"device_id,omitempty"`
	DeviceName     string     `json:"device_name,omitempty"`
	Moisture       float64    `json:"moisture"`
	TargetMoisture float64    `json:"target_moisture"`
	Status         ZoneStatus `json:"status"`
	RuntimeMinutes int        `json:"runtime_minutes"`
	FlowRateLPM    float64    `json:"flow_rate_lpm"`
	Latitude       *float64   `json:"latitude,omitempty"`
	Longitude      *float64   `json:"longitude,omitempty"`
	AccountID      int        `json:"account_id"`
	UserID         int        `json:"user_id"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type CommandSender interface {
	SendCommand(deviceID int, command string, parameters map[string]interface{}, userID int) error
}

type EventStatus string

const (
	EventStatusRunning   EventStatus = "running"
	EventStatusCompleted EventStatus = "completed"
	EventStatusFailed    EventStatus = "failed"
)

type EventTriggerType string

const (
	TriggerManual   EventTriggerType = "manual"
	TriggerSchedule EventTriggerType = "schedule"
	TriggerRule     EventTriggerType = "rule"
)

type IrrigationEvent struct {
	ID               int              `json:"id"`
	ZoneID           int              `json:"zone_id"`
	FieldID          int              `json:"field_id"`
	DeviceID         *int             `json:"device_id,omitempty"`
	Status           EventStatus      `json:"status"`
	StartTime        time.Time        `json:"start_time"`
	EndTime          *time.Time       `json:"end_time,omitempty"`
	DurationMinutes  int              `json:"duration_minutes"`
	WaterUsageLiters float64          `json:"water_usage_liters"`
	TriggerType      EventTriggerType `json:"trigger_type"`
	TriggeredBy      *int             `json:"triggered_by,omitempty"`
	AccountID        int              `json:"account_id"`
	CreatedAt        time.Time        `json:"created_at"`
}

type IrrigationZoneRepository interface {
	ListByFieldID(fieldID int, accountID int, userID int) ([]IrrigationZone, error)
	GetByID(id int) (*IrrigationZone, error)
	UpdateStatus(id int, status ZoneStatus) error
	Create(zone *IrrigationZone) error
	Update(zone *IrrigationZone) error
	Delete(id int, accountID int) error
}

type IrrigationEventRepository interface {
	Create(event *IrrigationEvent) error
	CompleteLatestRunning(zoneID int, endTime time.Time, duration int, waterUsage float64) error
	ListByZoneID(zoneID int, accountID int, limit int) ([]IrrigationEvent, error)
	ListByFieldID(fieldID int, accountID int, limit int) ([]IrrigationEvent, error)
}
