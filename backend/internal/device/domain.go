package device

import (
	"time"
)

type DeviceType string
type DeviceStatus string

const (
	DeviceTypeSensor     DeviceType = "sensor"
	DeviceTypeController DeviceType = "controller"
	DeviceTypeBoth       DeviceType = "both"

	DeviceStatusOnline  DeviceStatus = "online"
	DeviceStatusOffline DeviceStatus = "offline"
)

type Device struct {
	ID              int                    `json:"id"`
	DeviceID        string                 `json:"device_id"` // Unique hardware ID
	Name            string                 `json:"name"`
	Type            DeviceType             `json:"type"`
	Location        *string                `json:"location,omitempty"`
	Latitude        *float64               `json:"latitude,omitempty"`
	Longitude       *float64               `json:"longitude,omitempty"`
	Status          DeviceStatus           `json:"status"`
	LastHeartbeat   *time.Time             `json:"last_heartbeat,omitempty"`
	FirmwareVersion *string                `json:"firmware_version,omitempty"`
	Config          map[string]interface{} `json:"config,omitempty"`
	FieldID         *int                   `json:"field_id,omitempty"`
	UserID          *int                   `json:"user_id,omitempty"`
	AccountID       *int                   `json:"account_id,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

type DeviceFilter struct {
	Search string // case-insensitive match on device_id or name
}

type DeviceRepository interface {
	Create(device *Device) error
	GetByID(id int) (*Device, error)
	GetByDeviceID(deviceID string) (*Device, error)
	GetByUserID(userID int) ([]Device, error)
	Update(device *Device) error
	UpdateStatus(deviceID string, status DeviceStatus) error
	UpdateHeartbeat(deviceID string) error
	Delete(id, accountID int) error
	List(accountID, userID int, filter DeviceFilter, limit, offset int) ([]Device, int64, error)
	FindOrCreate(deviceID string) (*Device, error)
	ClaimDevice(deviceID string, userID, accountID int) error
	UnclaimDevice(deviceID string) error
	GetAndMarkOfflineByHeartbeat(timeout time.Duration) ([]Device, error)
	CountByStatus(status DeviceStatus) (int, error)
	// UpdateStatusIfChanged atomically sets the device to newStatus only if it is
	// currently different. Returns true if the status was actually changed.
	UpdateStatusIfChanged(deviceID string, newStatus DeviceStatus) (changed bool, err error)
}
