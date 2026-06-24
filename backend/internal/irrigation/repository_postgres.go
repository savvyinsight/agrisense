package irrigation

import (
	"database/sql"
	"fmt"
)

type PostgresIrrigationZoneRepository struct {
	DB *sql.DB
}

func (r *PostgresIrrigationZoneRepository) ListByFieldID(fieldID int, accountID int, userID int) ([]IrrigationZone, error) {
	var rows *sql.Rows
	var err error

	selectCols := `z.id, z.name, z.field_id, z.device_id, z.moisture, z.target_moisture, z.status,
	       z.runtime_minutes, z.flow_rate_lpm, z.latitude, z.longitude, z.account_id, z.user_id, z.created_at, z.updated_at,
	       COALESCE(d.name, '') AS device_name`
	fromClause := ` FROM irrigation_zones z LEFT JOIN devices d ON z.device_id = d.id`

	if fieldID > 0 {
		query := `SELECT ` + selectCols + fromClause +
			` WHERE z.field_id = $1 AND z.account_id = $2 AND (z.user_id = $3 OR $3 = 0) ORDER BY z.id`
		rows, err = r.DB.Query(query, fieldID, accountID, userID)
	} else {
		query := `SELECT ` + selectCols + fromClause +
			` WHERE z.account_id = $1 AND (z.user_id = $2 OR $2 = 0) ORDER BY z.id`
		rows, err = r.DB.Query(query, accountID, userID)
	}

	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	zones := make([]IrrigationZone, 0)
	for rows.Next() {
		var z IrrigationZone
		var lat, lng sql.NullFloat64
		var devID sql.NullInt64
		err := rows.Scan(
			&z.ID, &z.Name, &z.FieldID, &devID, &z.Moisture, &z.TargetMoisture, &z.Status,
			&z.RuntimeMinutes, &z.FlowRateLPM, &lat, &lng,
			&z.AccountID, &z.UserID, &z.CreatedAt, &z.UpdatedAt,
			&z.DeviceName,
		)
		if err != nil {
			return nil, err
		}
		if devID.Valid {
			v := int(devID.Int64)
			z.DeviceID = &v
		}
		if lat.Valid {
			z.Latitude = &lat.Float64
		}
		if lng.Valid {
			z.Longitude = &lng.Float64
		}
		zones = append(zones, z)
	}

	return zones, nil
}

func (r *PostgresIrrigationZoneRepository) GetByID(id int) (*IrrigationZone, error) {
	query := `SELECT z.id, z.name, z.field_id, z.device_id, z.moisture, z.target_moisture, z.status,
	       z.runtime_minutes, z.flow_rate_lpm, z.latitude, z.longitude, z.account_id, z.user_id, z.created_at, z.updated_at,
	       COALESCE(d.name, '') AS device_name
		FROM irrigation_zones z LEFT JOIN devices d ON z.device_id = d.id WHERE z.id = $1`

	var z IrrigationZone
	var lat, lng sql.NullFloat64
	var devID sql.NullInt64
	err := r.DB.QueryRow(query, id).Scan(
		&z.ID, &z.Name, &z.FieldID, &devID, &z.Moisture, &z.TargetMoisture, &z.Status,
		&z.RuntimeMinutes, &z.FlowRateLPM, &lat, &lng,
		&z.AccountID, &z.UserID, &z.CreatedAt, &z.UpdatedAt,
		&z.DeviceName,
	)
	if devID.Valid {
		v := int(devID.Int64)
		z.DeviceID = &v
	}
	if lat.Valid {
		z.Latitude = &lat.Float64
	}
	if lng.Valid {
		z.Longitude = &lng.Float64
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("zone not found")
	}
	if err != nil {
		return nil, err
	}

	return &z, nil
}

func (r *PostgresIrrigationZoneRepository) Create(zone *IrrigationZone) error {
	query := `INSERT INTO irrigation_zones
		(name, field_id, device_id, moisture, target_moisture, status, runtime_minutes, flow_rate_lpm, account_id, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
		RETURNING id, created_at, updated_at`
	return r.DB.QueryRow(query,
		zone.Name, zone.FieldID, zone.DeviceID, zone.Moisture, zone.TargetMoisture,
		zone.Status, zone.RuntimeMinutes, zone.FlowRateLPM, zone.AccountID, zone.UserID,
	).Scan(&zone.ID, &zone.CreatedAt, &zone.UpdatedAt)
}

func (r *PostgresIrrigationZoneRepository) Update(zone *IrrigationZone) error {
	query := `UPDATE irrigation_zones
		SET name = $1, target_moisture = $2, flow_rate_lpm = $3, device_id = $4, updated_at = NOW()
		WHERE id = $5 AND status NOT IN ('active')`
	result, err := r.DB.Exec(query, zone.Name, zone.TargetMoisture, zone.FlowRateLPM, zone.DeviceID, zone.ID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("zone not found or cannot be updated while active")
	}
	return nil
}

func (r *PostgresIrrigationZoneRepository) Delete(id int, accountID int) error {
	query := `DELETE FROM irrigation_zones WHERE id = $1 AND account_id = $2`
	result, err := r.DB.Exec(query, id, accountID)
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
