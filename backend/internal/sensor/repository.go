package sensor

import (
	"database/sql"
	"fmt"
)

type PostgresSensorTypeRepository struct {
	DB *sql.DB
}

func (r *PostgresSensorTypeRepository) GetSensorTypeByName(name string) (*SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types WHERE name = $1`

	var sensor SensorType
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

func (r *PostgresSensorTypeRepository) GetSensorTypes() ([]SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types ORDER BY id`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sensors []SensorType
	for rows.Next() {
		var sensor SensorType
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

func (r *PostgresSensorTypeRepository) GetSensorTypeByID(id int) (*SensorType, error) {
	query := `SELECT id, name, unit, min_value, max_value, icon FROM sensor_types WHERE id = $1`

	var sensor SensorType
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
