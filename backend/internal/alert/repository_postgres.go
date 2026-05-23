package alert

import (
	"database/sql"
	"fmt"
	"time"
)

const alertRuleColumns = `id, name, device_id, field_id, sensor_type_id, condition, threshold_value,
	threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at,
	recovery_threshold_value, recovery_condition, trend_condition,
	auto_escalation_enabled, auto_escalation_minutes, auto_escalation_severity`

type PostgresAlertRuleRepository struct {
	DB *sql.DB
}

func scanAlertRule(row interface{ Scan(dest ...interface{}) error }, rule *AlertRule) error {
	return row.Scan(
		&rule.ID, &rule.Name, &rule.DeviceID, &rule.FieldID, &rule.SensorTypeID,
		&rule.Condition, &rule.ThresholdValue, &rule.ThresholdMax,
		&rule.DurationSeconds, &rule.Severity, &rule.Enabled, &rule.UserID,
		&rule.CreatedAt, &rule.UpdatedAt,
		&rule.RecoveryThresholdValue, &rule.RecoveryCondition, &rule.TrendCondition,
		&rule.AutoEscalationEnabled, &rule.AutoEscalationMinutes, &rule.AutoEscalationSeverity,
	)
}

func (r *PostgresAlertRuleRepository) Create(rule *AlertRule) error {
	query := `
		INSERT INTO alert_rules (
			name, device_id, field_id, sensor_type_id, condition, threshold_value,
			threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at,
			recovery_threshold_value, recovery_condition, trend_condition,
			auto_escalation_enabled, auto_escalation_minutes, auto_escalation_severity
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
		RETURNING id`

	now := time.Now()
	err := r.DB.QueryRow(
		query,
		rule.Name, rule.DeviceID, rule.FieldID, rule.SensorTypeID,
		rule.Condition, rule.ThresholdValue, rule.ThresholdMax,
		rule.DurationSeconds, rule.Severity, rule.Enabled, rule.UserID, now, now,
		rule.RecoveryThresholdValue, rule.RecoveryCondition, rule.TrendCondition,
		rule.AutoEscalationEnabled, rule.AutoEscalationMinutes, rule.AutoEscalationSeverity,
	).Scan(&rule.ID)

	return err
}

func (r *PostgresAlertRuleRepository) GetByID(id int) (*AlertRule, error) {
	query := `SELECT ` + alertRuleColumns + ` FROM alert_rules WHERE id = $1`

	var rule AlertRule
	err := scanAlertRule(r.DB.QueryRow(query, id), &rule)
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *PostgresAlertRuleRepository) GetByDeviceID(deviceID int) ([]AlertRule, error) {
	query := `SELECT ` + alertRuleColumns + ` FROM alert_rules WHERE device_id = $1 OR device_id IS NULL`

	rows, err := r.DB.Query(query, deviceID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var rules []AlertRule
	for rows.Next() {
		var rule AlertRule
		if err := scanAlertRule(rows, &rule); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAlertRuleRepository) GetEnabledRules() ([]AlertRule, error) {
	query := `SELECT ` + alertRuleColumns + ` FROM alert_rules WHERE enabled = true`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var rules []AlertRule
	for rows.Next() {
		var rule AlertRule
		if err := scanAlertRule(rows, &rule); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAlertRuleRepository) Update(rule *AlertRule) error {
	query := `
		UPDATE alert_rules
		SET name = $1, device_id = $2, field_id = $3, sensor_type_id = $4, condition = $5,
			threshold_value = $6, threshold_max = $7, duration_seconds = $8,
			severity = $9, enabled = $10, updated_at = $11,
			recovery_threshold_value = $12, recovery_condition = $13, trend_condition = $14,
			auto_escalation_enabled = $15, auto_escalation_minutes = $16, auto_escalation_severity = $17
		WHERE id = $18`

	_, err := r.DB.Exec(
		query,
		rule.Name, rule.DeviceID, rule.FieldID, rule.SensorTypeID,
		rule.Condition, rule.ThresholdValue, rule.ThresholdMax,
		rule.DurationSeconds, rule.Severity, rule.Enabled, time.Now(),
		rule.RecoveryThresholdValue, rule.RecoveryCondition, rule.TrendCondition,
		rule.AutoEscalationEnabled, rule.AutoEscalationMinutes, rule.AutoEscalationSeverity,
		rule.ID,
	)

	return err
}

func (r *PostgresAlertRuleRepository) Delete(id int) error {
	query := `DELETE FROM alert_rules WHERE id = $1`
	result, err := r.DB.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (r *PostgresAlertRuleRepository) List(userID int) ([]AlertRule, error) {
	query := `SELECT ` + alertRuleColumns + ` FROM alert_rules WHERE user_id = $1 ORDER BY id`

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var rules []AlertRule
	for rows.Next() {
		var rule AlertRule
		if err := scanAlertRule(rows, &rule); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAlertRuleRepository) GetAutoEscalationRules() ([]AlertRule, error) {
	query := `SELECT ` + alertRuleColumns + ` FROM alert_rules WHERE auto_escalation_enabled = true AND enabled = true`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get auto-escalation rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var rules []AlertRule
	for rows.Next() {
		var rule AlertRule
		if err := scanAlertRule(rows, &rule); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

// AlertCorrelation is defined in domain.go
