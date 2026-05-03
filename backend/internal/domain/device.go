package domain

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
    DeviceID        string                 `json:"device_id"`      // Unique hardware ID
    Name            string                 `json:"name"`
    Type            DeviceType             `json:"type"`
    Location        *string                `json:"location,omitempty"`
    Latitude        *float64               `json:"latitude,omitempty"`
    Longitude       *float64               `json:"longitude,omitempty"`
    Status          DeviceStatus           `json:"status"`
    LastHeartbeat   *time.Time             `json:"last_heartbeat,omitempty"`
    FirmwareVersion *string                `json:"firmware_version,omitempty"`
    Config          map[string]interface{} `json:"config,omitempty"`
    UserID          int                    `json:"user_id"`
    CreatedAt       time.Time              `json:"created_at"`
    UpdatedAt       time.Time              `json:"updated_at"`
}

type DeviceRepository interface {
    Create(device *Device) error
    GetByID(id int) (*Device, error)
    GetByDeviceID(deviceID string) (*Device, error)
    GetByUserID(userID int) ([]Device, error)
    Update(device *Device) error
    UpdateStatus(deviceID string, status DeviceStatus) error
    UpdateHeartbeat(deviceID string) error
    Delete(id int) error
    List(userID int, limit, offset int) ([]Device, int64, error)
}
