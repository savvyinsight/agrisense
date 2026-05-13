package irrigation

import (
	"database/sql"
	"fmt"
)

type PostgresIrrigationZoneRepository struct {
	DB *sql.DB
}

func (r *PostgresIrrigationZoneRepository) ListByFieldID(fieldID int, userID int) ([]IrrigationZone, error) {
	var rows *sql.Rows
	var err error

	if fieldID > 0 {
		query := `
			SELECT id, name, field_id, moisture, target_moisture, status,
			       runtime_minutes, flow_rate_lpm, user_id, created_at, updated_at
			FROM irrigation_zones
			WHERE field_id = $1 AND (user_id = $2 OR $2 = 0)
			ORDER BY id
		`
		rows, err = r.DB.Query(query, fieldID, userID)
	} else {
		query := `
			SELECT id, name, field_id, moisture, target_moisture, status,
			       runtime_minutes, flow_rate_lpm, user_id, created_at, updated_at
			FROM irrigation_zones
			WHERE user_id = $1 OR $1 = 0
			ORDER BY id
		`
		rows, err = r.DB.Query(query, userID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var zones []IrrigationZone
	for rows.Next() {
		var z IrrigationZone
		err := rows.Scan(
			&z.ID, &z.Name, &z.FieldID, &z.Moisture, &z.TargetMoisture, &z.Status,
			&z.RuntimeMinutes, &z.FlowRateLPM, &z.UserID, &z.CreatedAt, &z.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		zones = append(zones, z)
	}

	return zones, nil
}

func (r *PostgresIrrigationZoneRepository) GetByID(id int) (*IrrigationZone, error) {
	query := `
		SELECT id, name, field_id, moisture, target_moisture, status,
		       runtime_minutes, flow_rate_lpm, user_id, created_at, updated_at
		FROM irrigation_zones WHERE id = $1
	`

	var z IrrigationZone
	err := r.DB.QueryRow(query, id).Scan(
		&z.ID, &z.Name, &z.FieldID, &z.Moisture, &z.TargetMoisture, &z.Status,
		&z.RuntimeMinutes, &z.FlowRateLPM, &z.UserID, &z.CreatedAt, &z.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("zone not found")
	}
	if err != nil {
		return nil, err
	}

	return &z, nil
}

func (r *PostgresIrrigationZoneRepository) UpdateStatus(id int, status ZoneStatus) error {
	query := `UPDATE irrigation_zones SET status = $1, updated_at = NOW() WHERE id = $2`
	result, err := r.DB.Exec(query, status, id)
	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return fmt.Errorf("zone with id %d not found", id)
	}

	return nil
}
