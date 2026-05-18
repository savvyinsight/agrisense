package field

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type PostgresFieldRepository struct {
	DB *sql.DB
}

func (r *PostgresFieldRepository) Create(field *Field) error {
	query := `
		INSERT INTO fields (name, crop, area_hectares, health, soil_moisture, temperature, humidity, last_irrigation, latitude, longitude, geometry, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id
	`

	now := time.Now()
	err := r.DB.QueryRow(
		query,
		field.Name, field.Crop, field.AreaHectares, field.Health,
		field.SoilMoisture, field.Temperature, field.Humidity,
		field.LastIrrigation, field.Latitude, field.Longitude,
		field.Geometry, field.UserID, now, now,
	).Scan(&field.ID)

	return err
}

func (r *PostgresFieldRepository) GetByID(id int) (*Field, error) {
	query := `
		SELECT id, name, crop, area_hectares, health, soil_moisture, temperature, humidity,
		       last_irrigation, latitude, longitude, geometry, user_id, created_at, updated_at
		FROM fields WHERE id = $1
	`

	var f Field
	var crop, area sql.NullString
	var geometryBytes []byte
	var soilMoisture, temperature, humidity sql.NullFloat64
	var lastIrrigation sql.NullTime
	var lat, lng sql.NullFloat64

	err := r.DB.QueryRow(query, id).Scan(
		&f.ID, &f.Name, &crop, &area, &f.Health,
		&soilMoisture, &temperature, &humidity,
		&lastIrrigation, &lat, &lng, &geometryBytes, &f.UserID, &f.CreatedAt, &f.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("field not found")
	}
	if err != nil {
		return nil, err
	}

	if crop.Valid {
		f.Crop = &crop.String
	}
	if area.Valid {
		v := 0.0
		fmt.Sscanf(area.String, "%f", &v)
		f.AreaHectares = &v
	}
	if soilMoisture.Valid {
		f.SoilMoisture = &soilMoisture.Float64
	}
	if temperature.Valid {
		f.Temperature = &temperature.Float64
	}
	if humidity.Valid {
		f.Humidity = &humidity.Float64
	}
	if lastIrrigation.Valid {
		f.LastIrrigation = &lastIrrigation.Time
	}
	if lat.Valid {
		f.Latitude = &lat.Float64
	}
	if lng.Valid {
		f.Longitude = &lng.Float64
	}
	if geometryBytes != nil {
		raw := json.RawMessage(geometryBytes)
		f.Geometry = &raw
	}

	return &f, nil
}

func (r *PostgresFieldRepository) List(userID int) ([]Field, error) {
	query := `
		SELECT id, name, crop, area_hectares, health, soil_moisture, temperature, humidity,
		       last_irrigation, latitude, longitude, geometry, user_id, created_at, updated_at
		FROM fields WHERE user_id = $1 OR $1 = 0
		ORDER BY id
	`

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []Field
	for rows.Next() {
		var f Field
		var crop, area sql.NullString
		var geometryBytes []byte
		var soilMoisture, temperature, humidity sql.NullFloat64
		var lastIrrigation sql.NullTime
		var lat, lng sql.NullFloat64

		err := rows.Scan(
			&f.ID, &f.Name, &crop, &area, &f.Health,
			&soilMoisture, &temperature, &humidity,
			&lastIrrigation, &lat, &lng, &geometryBytes, &f.UserID, &f.CreatedAt, &f.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if crop.Valid {
			f.Crop = &crop.String
		}
		if soilMoisture.Valid {
			f.SoilMoisture = &soilMoisture.Float64
		}
		if temperature.Valid {
			f.Temperature = &temperature.Float64
		}
		if humidity.Valid {
			f.Humidity = &humidity.Float64
		}
		if lastIrrigation.Valid {
			f.LastIrrigation = &lastIrrigation.Time
		}
		if lat.Valid {
			f.Latitude = &lat.Float64
		}
		if lng.Valid {
			f.Longitude = &lng.Float64
		}
		if geometryBytes != nil {
			raw := json.RawMessage(geometryBytes)
			f.Geometry = &raw
		}

		fields = append(fields, f)
	}

	return fields, nil
}

func (r *PostgresFieldRepository) Update(field *Field) error {
	query := `
		UPDATE fields
		SET name = $1, crop = $2, area_hectares = $3, health = $4,
		    soil_moisture = $5, temperature = $6, humidity = $7,
		    last_irrigation = $8, latitude = $9, longitude = $10, geometry = $11, updated_at = $12
		WHERE id = $13
	`

	_, err := r.DB.Exec(
		query,
		field.Name, field.Crop, field.AreaHectares, field.Health,
		field.SoilMoisture, field.Temperature, field.Humidity,
		field.LastIrrigation, field.Latitude, field.Longitude,
		field.Geometry, time.Now(), field.ID,
	)

	return err
}

func (r *PostgresFieldRepository) UpdateSensorData(fieldID int, moisture, temperature, humidity float64) error {
	query := `UPDATE fields SET soil_moisture = $1, temperature = $2, humidity = $3, updated_at = NOW() WHERE id = $4`
	_, err := r.DB.Exec(query, moisture, temperature, humidity, fieldID)
	return err
}

func (r *PostgresFieldRepository) Delete(id int) error {
	query := `DELETE FROM fields WHERE id = $1`
	result, err := r.DB.Exec(query, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("field with id %d not found", id)
	}

	return nil
}
