package postgres

import (
	"database/sql"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type AlertRuleRepository struct {
	DB *sql.DB
}

func (r *AlertRuleRepository) Create(rule *domain.AlertRule) error {
	query := `
        INSERT INTO alert_rules (
            name, device_id, sensor_type_id, condition, threshold_value, 
            threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
    `

	now := time.Now()
	err := r.DB.QueryRow(
		query,
		rule.Name,
		rule.DeviceID,
		rule.SensorTypeID,
		rule.Condition,
		rule.ThresholdValue,
		rule.ThresholdMax,
		rule.DurationSeconds,
		rule.Severity,
		rule.Enabled,
		rule.UserID,
		now,
		now,
	).Scan(&rule.ID)

	return err
}

func (r *AlertRuleRepository) GetByID(id int) (*domain.AlertRule, error) {
	query := `SELECT id, name, device_id, sensor_type_id, condition, threshold_value, 
                     threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at
              FROM alert_rules WHERE id = $1`

	var rule domain.AlertRule
	err := r.DB.QueryRow(query, id).Scan(
		&rule.ID,
		&rule.Name,
		&rule.DeviceID,
		&rule.SensorTypeID,
		&rule.Condition,
		&rule.ThresholdValue,
		&rule.ThresholdMax,
		&rule.DurationSeconds,
		&rule.Severity,
		&rule.Enabled,
		&rule.UserID,
		&rule.CreatedAt,
		&rule.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *AlertRuleRepository) GetByDeviceID(deviceID int) ([]domain.AlertRule, error) {
	query := `SELECT id, name, device_id, sensor_type_id, condition, threshold_value, 
                     threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at
              FROM alert_rules WHERE device_id = $1 OR device_id IS NULL`

	rows, err := r.DB.Query(query, deviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []domain.AlertRule
	for rows.Next() {
		var rule domain.AlertRule
		err := rows.Scan(
			&rule.ID,
			&rule.Name,
			&rule.DeviceID,
			&rule.SensorTypeID,
			&rule.Condition,
			&rule.ThresholdValue,
			&rule.ThresholdMax,
			&rule.DurationSeconds,
			&rule.Severity,
			&rule.Enabled,
			&rule.UserID,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *AlertRuleRepository) GetEnabledRules() ([]domain.AlertRule, error) {
	query := `SELECT id, name, device_id, sensor_type_id, condition, threshold_value, 
                     threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at
              FROM alert_rules WHERE enabled = true`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []domain.AlertRule
	for rows.Next() {
		var rule domain.AlertRule
		err := rows.Scan(
			&rule.ID,
			&rule.Name,
			&rule.DeviceID,
			&rule.SensorTypeID,
			&rule.Condition,
			&rule.ThresholdValue,
			&rule.ThresholdMax,
			&rule.DurationSeconds,
			&rule.Severity,
			&rule.Enabled,
			&rule.UserID,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *AlertRuleRepository) Update(rule *domain.AlertRule) error {
	query := `
        UPDATE alert_rules 
        SET name = $1, device_id = $2, sensor_type_id = $3, condition = $4, 
            threshold_value = $5, threshold_max = $6, duration_seconds = $7, 
            severity = $8, enabled = $9, updated_at = $10
        WHERE id = $11
    `

	_, err := r.DB.Exec(
		query,
		rule.Name,
		rule.DeviceID,
		rule.SensorTypeID,
		rule.Condition,
		rule.ThresholdValue,
		rule.ThresholdMax,
		rule.DurationSeconds,
		rule.Severity,
		rule.Enabled,
		time.Now(),
		rule.ID,
	)

	return err
}

func (r *AlertRuleRepository) Delete(id int) error {
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

func (r *AlertRuleRepository) List(userID int) ([]domain.AlertRule, error) {
	query := `SELECT id, name, device_id, sensor_type_id, condition, threshold_value, 
                     threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at
              FROM alert_rules WHERE user_id = $1 ORDER BY id`

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []domain.AlertRule
	for rows.Next() {
		var rule domain.AlertRule
		err := rows.Scan(
			&rule.ID,
			&rule.Name,
			&rule.DeviceID,
			&rule.SensorTypeID,
			&rule.Condition,
			&rule.ThresholdValue,
			&rule.ThresholdMax,
			&rule.DurationSeconds,
			&rule.Severity,
			&rule.Enabled,
			&rule.UserID,
			&rule.CreatedAt,
			&rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}
