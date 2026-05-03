package domain

import (
	"time"
)

type SensorType struct {
	ID       int     `json:"id"`
	Name     string  `json:"name"` // temperature, humidity, etc.
	Unit     string  `json:"unit"` // °C, %, etc.
	MinValue float64 `json:"min_value"`
	MaxValue float64 `json:"max_value"`
	Icon     string  `json:"icon"`
}

type SensorData struct {
	DeviceID   string    `json:"device_id"`
	SensorType string    `json:"sensor_type"`
	Value      float64   `json:"value"`
	Timestamp  time.Time `json:"timestamp"`
}

type AggregatedData struct {
	Timestamp time.Time `json:"timestamp"`
	Avg       float64   `json:"avg"`
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Count     int       `json:"count"`
}

// SensorTypeRepository handles sensor metadata (PostgreSQL)
type SensorTypeRepository interface {
	GetSensorTypeByName(name string) (*SensorType, error)
	GetSensorTypes() ([]SensorType, error)
	GetSensorTypeByID(id int) (*SensorType, error)
}

// InfluxRepository handles time-series data (InfluxDB)
type InfluxRepository interface {
	WriteData(data *SensorData) error
	WriteBatch(data []SensorData) error
	Query(deviceID string, sensorType string, start, end time.Time) ([]SensorData, error)
	QueryAggregate(deviceID string, sensorType string, start, end time.Time, interval string) ([]AggregatedData, error)
}

// CacheRepository interface for Redis operations
type CacheRepository interface {
	SetJSON(key string, value interface{}, ttl time.Duration) error
	GetJSON(key string, dest interface{}) error
	Delete(key string) error
	SetDeviceStatus(deviceID string, status string) error
	GetDeviceStatus(deviceID string) (string, error)
}
