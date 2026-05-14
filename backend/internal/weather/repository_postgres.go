package weather

import (
	"database/sql"
)

type PostgresWeatherRepository struct {
	DB *sql.DB
}

func (r *PostgresWeatherRepository) GetCurrent() (*WeatherData, error) {
	query := `
		SELECT id, temperature, humidity, rainfall_mm, wind_speed, forecast, recorded_at
		FROM weather_data
		ORDER BY recorded_at DESC
		LIMIT 1
	`

	var w WeatherData
	var temp, humidity sql.NullFloat64

	err := r.DB.QueryRow(query).Scan(
		&w.ID, &temp, &humidity, &w.RainfallMM, &w.WindSpeed, &w.Forecast, &w.RecordedAt,
	)

	if err == sql.ErrNoRows {
		return nil, err
	}
	if err != nil {
		return nil, err
	}

	if temp.Valid {
		w.Temperature = &temp.Float64
	}
	if humidity.Valid {
		w.Humidity = &humidity.Float64
	}

	return &w, nil
}
