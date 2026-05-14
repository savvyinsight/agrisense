package weather

import "time"

type WeatherData struct {
	ID          int       `json:"id"`
	Temperature *float64  `json:"temperature,omitempty"`
	Humidity    *float64  `json:"humidity,omitempty"`
	RainfallMM  float64   `json:"rainfall_mm"`
	WindSpeed   float64   `json:"wind_speed"`
	Forecast    string    `json:"forecast"`
	RecordedAt  time.Time `json:"recorded_at"`
}

type WeatherRepository interface {
	GetCurrent() (*WeatherData, error)
}
