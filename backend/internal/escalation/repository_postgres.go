package escalation

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"
)

type PostgresEscalationRuleRepository struct {
	DB *sql.DB
}

func (r *PostgresEscalationRuleRepository) Create(rule *EscalationRule) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	now := time.Now()
	rule.CreatedAt = now
	rule.UpdatedAt = now

	err = tx.QueryRow(
		`INSERT INTO escalation_rules (name, trigger_severity, enabled, account_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		rule.Name, rule.TriggerSeverity, rule.Enabled, rule.AccountID, now, now,
	).Scan(&rule.ID)
	if err != nil {
		return fmt.Errorf("failed to create escalation rule: %w", err)
	}

	for i, level := range rule.Levels {
		level.RuleID = rule.ID
		level.LevelOrder = i + 1
		err = tx.QueryRow(
			`INSERT INTO escalation_levels (rule_id, level_order, delay_minutes, severity, channel_ids)
			VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			level.RuleID, level.LevelOrder, level.DelayMinutes, level.Severity, level.ChannelIDs,
		).Scan(&rule.Levels[i].ID)
		if err != nil {
			return fmt.Errorf("failed to create escalation level: %w", err)
		}
		rule.Levels[i].RuleID = rule.ID
		rule.Levels[i].LevelOrder = i + 1
	}

	return tx.Commit()
}

func (r *PostgresEscalationRuleRepository) GetByID(id int) (*EscalationRule, error) {
	var rule EscalationRule
	err := r.DB.QueryRow(
		`SELECT id, name, trigger_severity, enabled, account_id, created_at, updated_at
		FROM escalation_rules WHERE id = $1`, id,
	).Scan(&rule.ID, &rule.Name, &rule.TriggerSeverity, &rule.Enabled, &rule.AccountID, &rule.CreatedAt, &rule.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("escalation rule not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get escalation rule: %w", err)
	}

	levels, err := r.getLevels(rule.ID)
	if err != nil {
		return nil, err
	}
	rule.Levels = levels

	return &rule, nil
}

func (r *PostgresEscalationRuleRepository) List(accountID int) ([]EscalationRule, error) {
	rows, err := r.DB.Query(
		`SELECT id, name, trigger_severity, enabled, account_id, created_at, updated_at
		FROM escalation_rules WHERE account_id = $1 ORDER BY created_at DESC`, accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list escalation rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]EscalationRule, 0)
	for rows.Next() {
		var rule EscalationRule
		if err := rows.Scan(&rule.ID, &rule.Name, &rule.TriggerSeverity, &rule.Enabled, &rule.AccountID, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan escalation rule: %w", err)
		}

		levels, err := r.getLevels(rule.ID)
		if err != nil {
			return nil, err
		}
		rule.Levels = levels
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresEscalationRuleRepository) GetEnabledByAccountID(accountID int) ([]EscalationRule, error) {
	rows, err := r.DB.Query(
		`SELECT id, name, trigger_severity, enabled, account_id, created_at, updated_at
		FROM escalation_rules WHERE account_id = $1 AND enabled = true ORDER BY created_at DESC`, accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list enabled escalation rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]EscalationRule, 0)
	for rows.Next() {
		var rule EscalationRule
		if err := rows.Scan(&rule.ID, &rule.Name, &rule.TriggerSeverity, &rule.Enabled, &rule.AccountID, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan escalation rule: %w", err)
		}

		levels, err := r.getLevels(rule.ID)
		if err != nil {
			return nil, err
		}
		rule.Levels = levels
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *PostgresEscalationRuleRepository) Update(id int, rule *EscalationRule) error {
	tx, err := r.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	rule.UpdatedAt = time.Now()

	result, err := tx.Exec(
		`UPDATE escalation_rules SET name = $1, trigger_severity = $2, enabled = $3, updated_at = $4
		WHERE id = $5`,
		rule.Name, rule.TriggerSeverity, rule.Enabled, rule.UpdatedAt, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update escalation rule: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("escalation rule not found")
	}

	// Delete old levels and insert new ones
	if _, err := tx.Exec(`DELETE FROM escalation_levels WHERE rule_id = $1`, id); err != nil {
		return fmt.Errorf("failed to delete old escalation levels: %w", err)
	}

	for i, level := range rule.Levels {
		level.RuleID = id
		level.LevelOrder = i + 1
		err = tx.QueryRow(
			`INSERT INTO escalation_levels (rule_id, level_order, delay_minutes, severity, channel_ids)
			VALUES ($1, $2, $3, $4, $5) RETURNING id`,
			id, i+1, level.DelayMinutes, level.Severity, level.ChannelIDs,
		).Scan(&rule.Levels[i].ID)
		if err != nil {
			return fmt.Errorf("failed to create escalation level: %w", err)
		}
		rule.Levels[i].RuleID = id
		rule.Levels[i].LevelOrder = i + 1
	}

	return tx.Commit()
}

func (r *PostgresEscalationRuleRepository) Delete(id int, accountID int) error {
	result, err := r.DB.Exec(`DELETE FROM escalation_rules WHERE id = $1 AND account_id = $2`, id, accountID)
	if err != nil {
		return fmt.Errorf("failed to delete escalation rule: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("escalation rule not found")
	}
	return nil
}

func (r *PostgresEscalationRuleRepository) getLevels(ruleID int) ([]EscalationLevel, error) {
	rows, err := r.DB.Query(
		`SELECT id, rule_id, level_order, delay_minutes, severity, channel_ids
		FROM escalation_levels WHERE rule_id = $1 ORDER BY level_order`, ruleID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get escalation levels: %w", err)
	}
	defer func() { _ = rows.Close() }()

	levels := make([]EscalationLevel, 0)
	for rows.Next() {
		var level EscalationLevel
		if err := rows.Scan(&level.ID, &level.RuleID, &level.LevelOrder, &level.DelayMinutes, &level.Severity, pq.Array(&level.ChannelIDs)); err != nil {
			return nil, fmt.Errorf("failed to scan escalation level: %w", err)
		}
		levels = append(levels, level)
	}
	return levels, nil
}

// PostgresEscalationHistoryRepository implements EscalationHistoryRepository
type PostgresEscalationHistoryRepository struct {
	DB *sql.DB
}

func (r *PostgresEscalationHistoryRepository) Create(entry *EscalationHistoryEntry) error {
	entry.EscalatedAt = time.Now()
	return r.DB.QueryRow(
		`INSERT INTO escalation_history (alert_id, rule_id, level_order, escalated_at, channel_ids, notification_status)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		entry.AlertID, entry.RuleID, entry.LevelOrder, entry.EscalatedAt, entry.ChannelIDs, entry.NotificationStatus,
	).Scan(&entry.ID)
}

func (r *PostgresEscalationHistoryRepository) GetByAlertID(alertID int) ([]EscalationHistoryEntry, error) {
	rows, err := r.DB.Query(
		`SELECT id, alert_id, rule_id, level_order, escalated_at, channel_ids, notification_status
		FROM escalation_history WHERE alert_id = $1 ORDER BY escalated_at DESC`, alertID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get escalation history: %w", err)
	}
	defer func() { _ = rows.Close() }()

	entries := make([]EscalationHistoryEntry, 0)
	for rows.Next() {
		var entry EscalationHistoryEntry
		if err := rows.Scan(&entry.ID, &entry.AlertID, &entry.RuleID, &entry.LevelOrder,
			&entry.EscalatedAt, &entry.ChannelIDs, &entry.NotificationStatus); err != nil {
			return nil, fmt.Errorf("failed to scan escalation history: %w", err)
		}
		entries = append(entries, entry)
	}
	return entries, nil
}
