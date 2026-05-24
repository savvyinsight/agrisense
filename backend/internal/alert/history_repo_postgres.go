package alert

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

const alertColumns = `id, rule_id, device_id, sensor_value, message, severity,
	status, triggered_at, acknowledged_at, resolved_at, metadata,
	is_flapping, flap_count, snoozed_until, snooze_reason, correlation_id, root_cause_suggestion`

type PostgresAlertRepository struct {
	DB *sql.DB
}

func scanAlert(row interface{ Scan(dest ...interface{}) error }, alert *Alert) error {
	var metadataJSON []byte
	err := row.Scan(
		&alert.ID, &alert.RuleID, &alert.DeviceID, &alert.SensorValue,
		&alert.Message, &alert.Severity, &alert.Status, &alert.TriggeredAt,
		&alert.AcknowledgedAt, &alert.ResolvedAt, &metadataJSON,
		&alert.IsFlapping, &alert.FlapCount, &alert.SnoozedUntil, &alert.SnoozeReason,
		&alert.CorrelationID, &alert.RootCauseSuggestion,
	)
	if err != nil {
		return err
	}
	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &alert.Metadata); err != nil {
			return fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}
	return nil
}

func (r *PostgresAlertRepository) Create(alert *Alert) error {
	query := `
		INSERT INTO alerts (
			rule_id, device_id, sensor_value, message, severity,
			status, triggered_at, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`

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
		alert.RuleID, alert.DeviceID, alert.SensorValue, alert.Message,
		alert.Severity, alert.Status, alert.TriggeredAt, metadataJSON,
	).Scan(&alert.ID)

	return err
}

func (r *PostgresAlertRepository) GetActive() ([]Alert, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts WHERE status IN ('triggered') ORDER BY triggered_at DESC`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, err
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetActivePaginated(limit, offset int) ([]Alert, int64, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts WHERE status IN ('triggered') ORDER BY triggered_at DESC LIMIT $1 OFFSET $2`

	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, 0, err
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
	query := `SELECT ` + alertColumns + ` FROM alerts WHERE device_id = $1 ORDER BY triggered_at DESC`

	rows, err := r.DB.Query(query, deviceID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, err
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetByRuleID(ruleID int) ([]Alert, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts WHERE rule_id = $1 ORDER BY triggered_at DESC`

	rows, err := r.DB.Query(query, ruleID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, err
		}
		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func (r *PostgresAlertRepository) GetByID(id int) (*Alert, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts WHERE id = $1`

	var alert Alert
	err := scanAlert(r.DB.QueryRow(query, id), &alert)
	if err != nil {
		return nil, err
	}

	return &alert, nil
}

func (r *PostgresAlertRepository) GetActiveByRuleAndDevice(ruleID, deviceID int) (*Alert, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts
		WHERE rule_id = $1 AND device_id = $2 AND status IN ('triggered', 'acknowledged')
		ORDER BY triggered_at DESC LIMIT 1`

	var alert Alert
	err := scanAlert(r.DB.QueryRow(query, ruleID, deviceID), &alert)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &alert, nil
}

func (r *PostgresAlertRepository) GetActiveAlertsByField(fieldID int) ([]Alert, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts a
		JOIN devices d ON a.device_id = d.id
		WHERE d.field_id = $1 AND a.status IN ('triggered', 'acknowledged')
		ORDER BY a.triggered_at DESC`

	rows, err := r.DB.Query(query, fieldID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, err
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

func (r *PostgresAlertRepository) ResolveByRuleID(ruleID int) ([]int, error) {
	query := `UPDATE alerts SET status = $1, resolved_at = $2
		WHERE rule_id = $3 AND status IN ('triggered', 'acknowledged')
		RETURNING device_id`

	rows, err := r.DB.Query(query, AlertStatusResolved, time.Now(), ruleID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	deviceIDs := make([]int, 0)
	for rows.Next() {
		var devID int
		if err := rows.Scan(&devID); err != nil {
			return nil, err
		}
		deviceIDs = append(deviceIDs, devID)
	}
	return deviceIDs, nil
}

func (r *PostgresAlertRepository) List(limit, offset int) ([]Alert, int64, error) {
	query := `SELECT ` + alertColumns + ` FROM alerts ORDER BY triggered_at DESC LIMIT $1 OFFSET $2`

	rows, err := r.DB.Query(query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = rows.Close() }()

	var alerts []Alert
	for rows.Next() {
		var alert Alert
		if err := scanAlert(rows, &alert); err != nil {
			return nil, 0, err
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

func (r *PostgresAlertRepository) SnoozeAlert(id int, until time.Time, reason string) error {
	query := `UPDATE alerts SET snoozed_until = $1, snooze_reason = $2 WHERE id = $3 AND status = 'triggered'`
	_, err := r.DB.Exec(query, until, reason, id)
	return err
}

func (r *PostgresAlertRepository) UnsnoozeAlert(id int) error {
	query := `UPDATE alerts SET snoozed_until = NULL, snooze_reason = NULL WHERE id = $1`
	_, err := r.DB.Exec(query, id)
	return err
}

func (r *PostgresAlertRepository) GetAlertCorrelations() ([]AlertCorrelation, error) {
	query := `
		SELECT correlation_id, root_cause_suggestion, array_agg(id ORDER BY triggered_at DESC), COUNT(*)
		FROM alerts
		WHERE correlation_id IS NOT NULL AND status IN ('triggered', 'acknowledged')
		GROUP BY correlation_id, root_cause_suggestion
		ORDER BY MAX(triggered_at) DESC`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get alert correlations: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var correlations []AlertCorrelation
	for rows.Next() {
		var c AlertCorrelation
		var alertIDs []int64
		if err := rows.Scan(&c.CorrelationID, &c.RootCauseSuggestion, &alertIDs, &c.Count); err != nil {
			return nil, fmt.Errorf("failed to scan correlation: %w", err)
		}
		c.AlertIDs = make([]int, len(alertIDs))
		for i, id := range alertIDs {
			c.AlertIDs[i] = int(id)
		}
		correlations = append(correlations, c)
	}

	return correlations, nil
}

func (r *PostgresAlertRepository) UpdateFlapping(id int, isFlapping bool, flapCount int) error {
	query := `UPDATE alerts SET is_flapping = $1, flap_count = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, isFlapping, flapCount, id)
	return err
}

func (r *PostgresAlertRepository) UpdateCorrelation(id int, correlationID string, rootCause *string) error {
	query := `UPDATE alerts SET correlation_id = $1, root_cause_suggestion = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, correlationID, rootCause, id)
	return err
}
