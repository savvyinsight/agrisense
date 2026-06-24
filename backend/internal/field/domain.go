package field

import (
	"encoding/json"
	"time"
)

type FieldHealth string

const (
	FieldHealthHealthy  FieldHealth = "healthy"
	FieldHealthWarning  FieldHealth = "warning"
	FieldHealthCritical FieldHealth = "critical"
)

type Field struct {
	ID             int              `json:"id"`
	Name           string           `json:"name"`
	Crop           *string          `json:"crop,omitempty"`
	AreaHectares   *float64         `json:"area_hectares,omitempty"`
	Health         FieldHealth      `json:"health"`
	SoilMoisture   *float64         `json:"soil_moisture,omitempty"`
	Temperature    *float64         `json:"temperature,omitempty"`
	Humidity       *float64         `json:"humidity,omitempty"`
	LastIrrigation *time.Time       `json:"last_irrigation,omitempty"`
	Latitude       *float64         `json:"latitude,omitempty"`
	Longitude      *float64         `json:"longitude,omitempty"`
	Geometry       *json.RawMessage `json:"geometry,omitempty"`
	UserID         int              `json:"user_id"`
	AccountID      *int             `json:"account_id,omitempty"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

type FieldRepository interface {
	Create(field *Field) error
	GetByID(id int) (*Field, error)
	List(userID int) ([]Field, error)
	Update(field *Field) error
	Delete(id int) error
	UpdateSensorData(fieldID int, moisture, temperature, humidity float64) error
	UpdateHealth(fieldID int, health FieldHealth) error
}
