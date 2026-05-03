package postgres

import (
	"database/sql"
	"fmt"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type SensorTypeRepository struct {
	DB *sql.DB
}

func (r *SensorTypeRepository) GetSensorTypeByName(name string) (*domain.SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types WHERE name = $1`

	var sensor domain.SensorType
	err := r.DB.QueryRow(query, name).Scan(
		&sensor.ID,
		&sensor.Name,
		&sensor.Unit,
		&sensor.MinValue,
		&sensor.MaxValue,
		&sensor.Icon,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("sensor type %s not found", name)
	}
	if err != nil {
		return nil, err
	}

	return &sensor, nil
}

func (r *SensorTypeRepository) GetSensorTypes() ([]domain.SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types ORDER BY id`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sensors []domain.SensorType
	for rows.Next() {
		var sensor domain.SensorType
		err := rows.Scan(
			&sensor.ID,
			&sensor.Name,
			&sensor.Unit,
			&sensor.MinValue,
			&sensor.MaxValue,
			&sensor.Icon,
		)
		if err != nil {
			return nil, err
		}
		sensors = append(sensors, sensor)
	}

	return sensors, nil
}

func (r *SensorTypeRepository) GetSensorTypeByID(id int) (*domain.SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types WHERE id = $1`

	var sensor domain.SensorType
	err := r.DB.QueryRow(query, id).Scan(
		&sensor.ID,
		&sensor.Name,
		&sensor.Unit,
		&sensor.MinValue,
		&sensor.MaxValue,
		&sensor.Icon,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("sensor type with id %d not found", id)
	}
	if err != nil {
		return nil, err
	}

	return &sensor, nil
}
