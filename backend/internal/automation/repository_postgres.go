package automation

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

const automationRuleColumns = `id, name, target_device_id, trigger_type, trigger_sensor_type_id,
	trigger_condition, trigger_value, trigger_duration_seconds,
	schedule_cron, timezone, action_command, action_parameters,
	enabled, user_id, account_id, created_at, updated_at,
	paused, last_triggered_at, execution_count, last_command_status, metadata`

type PostgresAutomationRuleRepository struct {
	DB *sql.DB
}

func scanAutomationRule(row interface{ Scan(dest ...interface{}) error }, rule *AutomationRule) error {
	var actionParamsJSON, metadataJSON []byte
	err := row.Scan(
		&rule.ID, &rule.Name, &rule.TargetDeviceID, &rule.TriggerType, &rule.TriggerSensorTypeID,
		&rule.TriggerCondition, &rule.TriggerValue, &rule.TriggerDurationSeconds,
		&rule.ScheduleCron, &rule.Timezone, &rule.ActionCommand, &actionParamsJSON,
		&rule.Enabled, &rule.UserID, &rule.AccountID, &rule.CreatedAt, &rule.UpdatedAt,
		&rule.Paused, &rule.LastTriggeredAt, &rule.ExecutionCount, &rule.LastCommandStatus, &metadataJSON,
	)
	if err != nil {
		return err
	}
	if len(actionParamsJSON) > 0 {
		if err := json.Unmarshal(actionParamsJSON, &rule.ActionParameters); err != nil {
			return fmt.Errorf("failed to unmarshal action parameters: %w", err)
		}
	}
	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &rule.Metadata); err != nil {
			return fmt.Errorf("failed to unmarshal metadata: %w", err)
		}
	}
	return nil
}

func (r *PostgresAutomationRuleRepository) Create(rule *AutomationRule) error {
	query := `
		INSERT INTO automation_rules (
			name, target_device_id, trigger_type, trigger_sensor_type_id,
			trigger_condition, trigger_value, trigger_duration_seconds,
			schedule_cron, timezone, action_command, action_parameters,
			enabled, user_id, account_id, created_at, updated_at,
			paused, metadata
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		RETURNING id`

	actionParamsJSON, err := json.Marshal(rule.ActionParameters)
	if err != nil {
		return fmt.Errorf("failed to marshal action parameters: %w", err)
	}

	metadataJSON, err := json.Marshal(rule.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	now := rule.CreatedAt
	rule.UpdatedAt = now

	err = r.DB.QueryRow(query,
		rule.Name, rule.TargetDeviceID, rule.TriggerType, rule.TriggerSensorTypeID,
		rule.TriggerCondition, rule.TriggerValue, rule.TriggerDurationSeconds,
		rule.ScheduleCron, rule.Timezone, rule.ActionCommand, actionParamsJSON,
		rule.Enabled, rule.UserID, rule.AccountID, now, now,
		rule.Paused, metadataJSON).Scan(&rule.ID)

	if err != nil {
		return fmt.Errorf("failed to create automation rule: %w", err)
	}

	return nil
}

func (r *PostgresAutomationRuleRepository) GetByID(id int) (*AutomationRule, error) {
	query := `SELECT ` + automationRuleColumns + ` FROM automation_rules WHERE id = $1`

	var rule AutomationRule
	err := scanAutomationRule(r.DB.QueryRow(query, id), &rule)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("automation rule not found")
		}
		return nil, fmt.Errorf("failed to get automation rule: %w", err)
	}

	return &rule, nil
}

func (r *PostgresAutomationRuleRepository) GetByUserID(userID, accountID int) ([]AutomationRule, error) {
	query := `SELECT ` + automationRuleColumns + ` FROM automation_rules WHERE user_id = $1`

	args := []interface{}{userID}
	if accountID > 0 {
		query += ` AND account_id = $2`
		args = append(args, accountID)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]AutomationRule, 0)
	for rows.Next() {
		var rule AutomationRule
		if err := scanAutomationRule(rows, &rule); err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAutomationRuleRepository) GetEnabledRules(accountID int) ([]AutomationRule, error) {
	query := `SELECT ` + automationRuleColumns + ` FROM automation_rules WHERE enabled = true AND paused = false`

	args := []interface{}{}
	if accountID > 0 {
		query += ` AND account_id = $1`
		args = append(args, accountID)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get enabled automation rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]AutomationRule, 0)
	for rows.Next() {
		var rule AutomationRule
		if err := scanAutomationRule(rows, &rule); err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAutomationRuleRepository) Update(rule *AutomationRule) error {
	query := `
		UPDATE automation_rules SET
			name = $1, target_device_id = $2, trigger_type = $3, trigger_sensor_type_id = $4,
			trigger_condition = $5, trigger_value = $6, trigger_duration_seconds = $7,
			schedule_cron = $8, timezone = $9, action_command = $10, action_parameters = $11,
			enabled = $12, updated_at = $13, paused = $14, metadata = $15
		WHERE id = $16`

	actionParamsJSON, err := json.Marshal(rule.ActionParameters)
	if err != nil {
		return fmt.Errorf("failed to marshal action parameters: %w", err)
	}

	metadataJSON, err := json.Marshal(rule.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	rule.UpdatedAt = time.Now()

	_, err = r.DB.Exec(query,
		rule.Name, rule.TargetDeviceID, rule.TriggerType, rule.TriggerSensorTypeID,
		rule.TriggerCondition, rule.TriggerValue, rule.TriggerDurationSeconds,
		rule.ScheduleCron, rule.Timezone, rule.ActionCommand, actionParamsJSON,
		rule.Enabled, rule.UpdatedAt, rule.Paused, metadataJSON, rule.ID)

	if err != nil {
		return fmt.Errorf("failed to update automation rule: %w", err)
	}

	return nil
}

func (r *PostgresAutomationRuleRepository) Delete(id, accountID int) error {
	query := `DELETE FROM automation_rules WHERE id = $1`

	args := []interface{}{id}
	if accountID > 0 {
		query += ` AND account_id = $2`
		args = append(args, accountID)
	}

	result, err := r.DB.Exec(query, args...)
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

func (r *PostgresAutomationRuleRepository) GetByTargetDeviceID(deviceID, accountID int) ([]AutomationRule, error) {
	query := `SELECT ` + automationRuleColumns + ` FROM automation_rules WHERE target_device_id = $1 AND enabled = true AND paused = false`

	args := []interface{}{deviceID}
	if accountID > 0 {
		query += ` AND account_id = $2`
		args = append(args, accountID)
	}
	query += ` ORDER BY created_at DESC`

	rows, err := r.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation rules for device: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]AutomationRule, 0)
	for rows.Next() {
		var rule AutomationRule
		if err := scanAutomationRule(rows, &rule); err != nil {
			return nil, fmt.Errorf("failed to scan automation rule: %w", err)
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresAutomationRuleRepository) UpdatePartial(id int, updates map[string]interface{}) error {
	if len(updates) == 0 {
		return nil
	}

	query := `UPDATE automation_rules SET updated_at = $1`
	args := []interface{}{time.Now()}
	argIdx := 2

	for col, val := range updates {
		query += fmt.Sprintf(", %s = $%d", col, argIdx)
		args = append(args, val)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	_, err := r.DB.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update automation rule: %w", err)
	}
	return nil
}

func (r *PostgresAutomationRuleRepository) IncrementExecutionCount(id int) error {
	query := `UPDATE automation_rules SET execution_count = execution_count + 1, updated_at = $1 WHERE id = $2`
	_, err := r.DB.Exec(query, time.Now(), id)
	return err
}

func (r *PostgresAutomationRuleRepository) UpdateLastTriggered(id int) error {
	query := `UPDATE automation_rules SET last_triggered_at = $1, updated_at = $1 WHERE id = $2`
	now := time.Now()
	_, err := r.DB.Exec(query, now, id)
	return err
}

func (r *PostgresAutomationRuleRepository) UpdateLastCommandStatus(id int, status string) error {
	query := `UPDATE automation_rules SET last_command_status = $1, updated_at = $2 WHERE id = $3`
	_, err := r.DB.Exec(query, status, time.Now(), id)
	return err
}

func (r *PostgresAutomationRuleRepository) GetGlobalAutomationEnabled() (bool, error) {
	var enabled bool
	err := r.DB.QueryRow(`SELECT enabled FROM automation_global_settings LIMIT 1`).Scan(&enabled)
	if err != nil {
		return true, err // default to enabled
	}
	return enabled, nil
}

func (r *PostgresAutomationRuleRepository) SetGlobalAutomationEnabled(enabled bool) error {
	_, err := r.DB.Exec(`UPDATE automation_global_settings SET enabled = $1, updated_at = $2`, enabled, time.Now())
	return err
}

func (r *PostgresAutomationRuleRepository) GetCommandHistory(ruleID int, limit int) ([]map[string]interface{}, error) {
	query := `
		SELECT c.id, c.device_id, c.command, c.parameters, c.status,
		       c.created_at, c.sent_at, c.delivered_at, c.executed_at, c.metadata
		FROM control_commands c
		WHERE c.metadata->>'rule_id' = $1
		ORDER BY c.created_at DESC
		LIMIT $2`

	rows, err := r.DB.Query(query, fmt.Sprintf("%d", ruleID), limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get command history: %w", err)
	}
	defer func() { _ = rows.Close() }()

	commands := make([]map[string]interface{}, 0)
	for rows.Next() {
		var (
			id                             int
			deviceID                       int
			command                        string
			parametersJSON                 []byte
			status                         string
			createdAt                      time.Time
			sentAt, deliveredAt, executedAt *time.Time
			metadataJSON                   []byte
		)
		if err := rows.Scan(&id, &deviceID, &command, &parametersJSON, &status,
			&createdAt, &sentAt, &deliveredAt, &executedAt, &metadataJSON); err != nil {
			return nil, fmt.Errorf("failed to scan command: %w", err)
		}

		cmd := map[string]interface{}{
			"id":         id,
			"device_id":  deviceID,
			"command":    command,
			"status":     status,
			"created_at": createdAt,
		}
		if len(parametersJSON) > 0 {
			var params map[string]interface{}
			if json.Unmarshal(parametersJSON, &params) == nil {
				cmd["parameters"] = params
			}
		}
		if sentAt != nil {
			cmd["sent_at"] = *sentAt
		}
		if deliveredAt != nil {
			cmd["delivered_at"] = *deliveredAt
		}
		if executedAt != nil {
			cmd["executed_at"] = *executedAt
		}
		if len(metadataJSON) > 0 {
			var meta map[string]interface{}
			if json.Unmarshal(metadataJSON, &meta) == nil {
				cmd["metadata"] = meta
			}
		}
		commands = append(commands, cmd)
	}

	return commands, nil
}
