package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type AutomationRuleRepository struct {
	DB *sql.DB
}

func (r *AutomationRuleRepository) Create(rule *domain.AutomationRule) error {
	query := `
		INSERT INTO automation_rules (
			name, target_device_id, trigger_type, trigger_sensor_type_id,
			trigger_condition, trigger_value, trigger_duration_seconds,
			schedule_cron, timezone, action_command, action_parameters,
			enabled, user_id, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id`

	actionParamsJSON, err := json.Marshal(rule.ActionParameters)
	if err != nil {
		return fmt.Errorf("failed to marshal action parameters: %w", err)
	}

	now := rule.CreatedAt
	rule.UpdatedAt = now

	err = r.DB.QueryRow(query,
		rule.Name, rule.TargetDeviceID, rule.TriggerType, rule.TriggerSensorTypeID,
		rule.TriggerCondition, rule.TriggerValue, rule.TriggerDurationSeconds,
		rule.ScheduleCron, rule.Timezone, rule.ActionCommand, actionParamsJSON,
		rule.Enabled, rule.UserID, now, now).Scan(&rule.ID)

	if err != nil {
		return fmt.Errorf("failed to create automation rule: %w", err)
	}

	return nil
}

func (r *AutomationRuleRepository) GetByID(id int) (*domain.AutomationRule, error) {
	query := `
		SELECT id, name, target_device_id, trigger_type, trigger_sensor_type_id,
			   trigger_condition, trigger_value, trigger_duration_seconds,
			   schedule_cron, timezone, action_command, action_parameters,
			   enabled, user_id, created_at, updated_at
		FROM automation_rules WHERE id = $1`

	var rule domain.AutomationRule
	var actionParamsJSON []byte

	err := r.DB.QueryRow(query, id).Scan(
		&rule.ID, &rule.Name, &rule.TargetDeviceID, &rule.TriggerType, &rule.TriggerSensorTypeID,
		&rule.TriggerCondition, &rule.TriggerValue, &rule.TriggerDurationSeconds,
		&rule.ScheduleCron, &rule.Timezone, &rule.ActionCommand, &actionParamsJSON,
		&rule.Enabled, &rule.UserID, &rule.CreatedAt, &rule.UpdatedAt)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("automation rule not found")
		}
		return nil, fmt.Errorf("failed to get automation rule: %w", err)
	}

	// Unmarshal action parameters
	if len(actionParamsJSON) > 0 {
		err = json.Unmarshal(actionParamsJSON, &rule.ActionParameters)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal action parameters: %w", err)
		}
	}

	return &rule, nil
}

func (r *AutomationRuleRepository) GetByUserID(userID int) ([]domain.AutomationRule, error) {
	query := `
		SELECT id, name, target_device_id, trigger_type, trigger_sensor_type_id,
			   trigger_condition, trigger_value, trigger_duration_seconds,
			   schedule_cron, timezone, action_command, action_parameters,
			   enabled, user_id, created_at, updated_at
		FROM automation_rules WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation rules: %w", err)
	}
	defer rows.Close()

	var rules []domain.AutomationRule
	for rows.Next() {
		var rule domain.AutomationRule
		var actionParamsJSON []byte

		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.TargetDeviceID, &rule.TriggerType, &rule.TriggerSensorTypeID,
			&rule.TriggerCondition, &rule.TriggerValue, &rule.TriggerDurationSeconds,
			&rule.ScheduleCron, &rule.Timezone, &rule.ActionCommand, &actionParamsJSON,
			&rule.Enabled, &rule.UserID, &rule.CreatedAt, &rule.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}

		// Unmarshal action parameters
		if len(actionParamsJSON) > 0 {
			err = json.Unmarshal(actionParamsJSON, &rule.ActionParameters)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal action parameters: %w", err)
			}
		}

		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *AutomationRuleRepository) GetEnabledRules() ([]domain.AutomationRule, error) {
	query := `
		SELECT id, name, target_device_id, trigger_type, trigger_sensor_type_id,
			   trigger_condition, trigger_value, trigger_duration_seconds,
			   schedule_cron, timezone, action_command, action_parameters,
			   enabled, user_id, created_at, updated_at
		FROM automation_rules WHERE enabled = true ORDER BY created_at DESC`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to get enabled automation rules: %w", err)
	}
	defer rows.Close()

	var rules []domain.AutomationRule
	for rows.Next() {
		var rule domain.AutomationRule
		var actionParamsJSON []byte

		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.TargetDeviceID, &rule.TriggerType, &rule.TriggerSensorTypeID,
			&rule.TriggerCondition, &rule.TriggerValue, &rule.TriggerDurationSeconds,
			&rule.ScheduleCron, &rule.Timezone, &rule.ActionCommand, &actionParamsJSON,
			&rule.Enabled, &rule.UserID, &rule.CreatedAt, &rule.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}

		// Unmarshal action parameters
		if len(actionParamsJSON) > 0 {
			err = json.Unmarshal(actionParamsJSON, &rule.ActionParameters)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal action parameters: %w", err)
			}
		}

		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *AutomationRuleRepository) Update(rule *domain.AutomationRule) error {
	query := `
		UPDATE automation_rules SET
			name = $1, target_device_id = $2, trigger_type = $3, trigger_sensor_type_id = $4,
			trigger_condition = $5, trigger_value = $6, trigger_duration_seconds = $7,
			schedule_cron = $8, timezone = $9, action_command = $10, action_parameters = $11,
			enabled = $12, updated_at = $13
		WHERE id = $14`

	actionParamsJSON, err := json.Marshal(rule.ActionParameters)
	if err != nil {
		return fmt.Errorf("failed to marshal action parameters: %w", err)
	}

	rule.UpdatedAt = time.Now()

	_, err = r.DB.Exec(query,
		rule.Name, rule.TargetDeviceID, rule.TriggerType, rule.TriggerSensorTypeID,
		rule.TriggerCondition, rule.TriggerValue, rule.TriggerDurationSeconds,
		rule.ScheduleCron, rule.Timezone, rule.ActionCommand, actionParamsJSON,
		rule.Enabled, rule.UpdatedAt, rule.ID)

	if err != nil {
		return fmt.Errorf("failed to update automation rule: %w", err)
	}

	return nil
}

func (r *AutomationRuleRepository) Delete(id int) error {
	query := `DELETE FROM automation_rules WHERE id = $1`

	result, err := r.DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete automation rule: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("automation rule not found")
	}

	return nil
}

func (r *AutomationRuleRepository) GetByTargetDeviceID(deviceID int) ([]domain.AutomationRule, error) {
	query := `
		SELECT id, name, target_device_id, trigger_type, trigger_sensor_type_id,
			   trigger_condition, trigger_value, trigger_duration_seconds,
			   schedule_cron, timezone, action_command, action_parameters,
			   enabled, user_id, created_at, updated_at
		FROM automation_rules WHERE target_device_id = $1 AND enabled = true ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, deviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation rules for device: %w", err)
	}
	defer rows.Close()

	var rules []domain.AutomationRule
	for rows.Next() {
		var rule domain.AutomationRule
		var actionParamsJSON []byte

		err := rows.Scan(
			&rule.ID, &rule.Name, &rule.TargetDeviceID, &rule.TriggerType, &rule.TriggerSensorTypeID,
			&rule.TriggerCondition, &rule.TriggerValue, &rule.TriggerDurationSeconds,
			&rule.ScheduleCron, &rule.Timezone, &rule.ActionCommand, &actionParamsJSON,
			&rule.Enabled, &rule.UserID, &rule.CreatedAt, &rule.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}

		// Unmarshal action parameters
		if len(actionParamsJSON) > 0 {
			err = json.Unmarshal(actionParamsJSON, &rule.ActionParameters)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal action parameters: %w", err)
			}
		}

		rules = append(rules, rule)
	}

	return rules, nil
}
