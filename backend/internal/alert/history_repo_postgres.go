package alert

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type PostgresAlertRepository struct {
	DB *sql.DB
}

func (r *PostgresAlertRepository) Create(alert *Alert) error {
	query := `
        INSERT INTO alerts (
            rule_id, device_id, sensor_value, message, severity, 
            status, triggered_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
    `
	// Convert metadata to JSON if present
	var metadataJSON []byte
	var err error
	if alert.Metadata != nil {
		metadataJSON, err = json.Marshal(alert.Metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %w", err)
		}
	}

	err = r.DB.QueryRow(
		query,
		alert.RuleID,
		alert.DeviceID,
		alert.SensorValue,
		alert.Message,
		alert.Severity,
		alert.Status,
		alert.TriggeredAt,
		metadataJSON, // Pass as []byte, not map
	).Scan(&alert.ID)

	return err
}

func (r *PostgresAlertRepository) GetActive() ([]Alert, error) {
	query := `
        SELECT id, rule_id, device_id, sensor_value, message, severity, 
               status, triggered_at, acknowledged_at, resolved_at, metadata
        FROM alerts 
        WHERE status IN ('triggered')
        ORDER BY triggered_at DESC
    `

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		// ... scan into metadataJSON ...
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON, // Scan as []byte, not map
		)
		if err != nil {
			return nil, err
		}

		// Unmarshal JSON into map
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetActivePaginated(limit, offset int) ([]Alert, int64, error) {
	query := `
        SELECT id, rule_id, device_id, sensor_value, message, severity, 
               status, triggered_at, acknowledged_at, resolved_at, metadata
        FROM alerts 
        WHERE status IN ('triggered')
        ORDER BY triggered_at DESC
        LIMIT $1 OFFSET $2
    `

	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		// ... scan into metadataJSON ...
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON, // Scan as []byte, not map
		)
		if err != nil {
			return nil, 0, err
		}

		// Unmarshal JSON into map
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	var total int64
	err = r.DB.QueryRow(`SELECT COUNT(*) FROM alerts WHERE status IN ('triggered')`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return alerts, total, nil
}

func (r *PostgresAlertRepository) GetByDeviceID(deviceID int) ([]Alert, error) {
	query := `
        SELECT id, rule_id, device_id, sensor_value, message, severity, 
               status, triggered_at, acknowledged_at, resolved_at, metadata
        FROM alerts 
        WHERE device_id = $1
        ORDER BY triggered_at DESC
    `

	rows, err := r.DB.Query(query, deviceID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		// ... scan into metadataJSON ...
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON, // Scan as []byte, not map
		)
		if err != nil {
			return nil, err
		}

		// Unmarshal JSON into map
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetByRuleID(ruleID int) ([]Alert, error) {
	query := `
        SELECT id, rule_id, device_id, sensor_value, message, severity, 
               status, triggered_at, acknowledged_at, resolved_at, metadata
        FROM alerts 
        WHERE rule_id = $1
        ORDER BY triggered_at DESC
    `

	rows, err := r.DB.Query(query, ruleID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		// ... scan into metadataJSON ...
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON, // Scan as []byte, not map
		)
		if err != nil {
			return nil, err
		}

		// Unmarshal JSON into map
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetByID(id int) (*Alert, error) {
	query := `
		SELECT id, rule_id, device_id, sensor_value, message, severity,
		       status, triggered_at, acknowledged_at, resolved_at, metadata
		FROM alerts WHERE id = $1
	`

	var alert Alert
	var metadataJSON []byte
	err := r.DB.QueryRow(query, id).Scan(
		&alert.ID,
		&alert.RuleID,
		&alert.DeviceID,
		&alert.SensorValue,
		&alert.Message,
		&alert.Severity,
		&alert.Status,
		&alert.TriggeredAt,
		&alert.AcknowledgedAt,
		&alert.ResolvedAt,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return &alert, nil
}

func (r *PostgresAlertRepository) GetActiveByRuleAndDevice(ruleID, deviceID int) (*Alert, error) {
	query := `
		SELECT id, rule_id, device_id, sensor_value, message, severity,
		       status, triggered_at, acknowledged_at, resolved_at, metadata
		FROM alerts
		WHERE rule_id = $1 AND device_id = $2 AND status IN ('triggered', 'acknowledged')
		ORDER BY triggered_at DESC
		LIMIT 1
	`

	var alert Alert
	var metadataJSON []byte
	err := r.DB.QueryRow(query, ruleID, deviceID).Scan(
		&alert.ID,
		&alert.RuleID,
		&alert.DeviceID,
		&alert.SensorValue,
		&alert.Message,
		&alert.Severity,
		&alert.Status,
		&alert.TriggeredAt,
		&alert.AcknowledgedAt,
		&alert.ResolvedAt,
		&metadataJSON,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}

	return &alert, nil
}

func (r *PostgresAlertRepository) GetActiveAlertsByField(fieldID int) ([]Alert, error) {
	query := `
		SELECT a.id, a.rule_id, a.device_id, a.sensor_value, a.message, a.severity,
		       a.status, a.triggered_at, a.acknowledged_at, a.resolved_at, a.metadata
		FROM alerts a
		JOIN devices d ON a.device_id = d.id
		WHERE d.field_id = $1 AND a.status IN ('triggered', 'acknowledged')
		ORDER BY a.triggered_at DESC
	`

	rows, err := r.DB.Query(query, fieldID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) Acknowledge(id int) error {
	query := `UPDATE alerts SET status = $1, acknowledged_at = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, AlertStatusAcknowledged, time.Now(), id)
	return err
}

func (r *PostgresAlertRepository) Resolve(id int) error {
	query := `UPDATE alerts SET status = $1, resolved_at = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, AlertStatusResolved, time.Now(), id)
	return err
}

func (r *PostgresAlertRepository) List(limit, offset int) ([]Alert, int64, error) {
	query := `
        SELECT id, rule_id, device_id, sensor_value, message, severity, 
               status, triggered_at, acknowledged_at, resolved_at, metadata
        FROM alerts 
        ORDER BY triggered_at DESC
        LIMIT $1 OFFSET $2
    `

	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		var metadataJSON []byte
		// ... scan into metadataJSON ...
		err := rows.Scan(
			&alert.ID,
			&alert.RuleID,
			&alert.DeviceID,
			&alert.SensorValue,
			&alert.Message,
			&alert.Severity,
			&alert.Status,
			&alert.TriggeredAt,
			&alert.AcknowledgedAt,
			&alert.ResolvedAt,
			&metadataJSON, // Scan as []byte, not map
		)
		if err != nil {
			return nil, 0, err
		}

		// Unmarshal JSON into map
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal metadata: %w", err)
			}
		}

		alerts = append(alerts, alert)
	}

	var total int64
	err = r.DB.QueryRow(`SELECT COUNT(*) FROM alerts`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return alerts, total, nil
}
