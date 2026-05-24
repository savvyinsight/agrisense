package notification

import (
	"database/sql"
	"fmt"
	"time"
)

type PostgresChannelRepository struct {
	DB *sql.DB
}

func (r *PostgresChannelRepository) Create(ch *Channel) error {
	query := `INSERT INTO notification_channels (type, name, config, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`

	now := time.Now()
	ch.CreatedAt = now
	ch.UpdatedAt = now

	return r.DB.QueryRow(query, ch.Type, ch.Name, ch.Config, ch.Enabled, now, now).Scan(&ch.ID)
}

func (r *PostgresChannelRepository) GetByID(id int) (*Channel, error) {
	query := `SELECT id, type, name, config, enabled, created_at, updated_at
		FROM notification_channels WHERE id = $1`

	var ch Channel
	err := r.DB.QueryRow(query, id).Scan(
		&ch.ID, &ch.Type, &ch.Name, &ch.Config, &ch.Enabled, &ch.CreatedAt, &ch.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("notification channel not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get notification channel: %w", err)
	}
	return &ch, nil
}

func (r *PostgresChannelRepository) List() ([]Channel, error) {
	query := `SELECT id, type, name, config, enabled, created_at, updated_at
		FROM notification_channels ORDER BY created_at DESC`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list notification channels: %w", err)
	}
	defer func() { _ = rows.Close() }()

	channels := make([]Channel, 0)
	for rows.Next() {
		var ch Channel
		if err := rows.Scan(&ch.ID, &ch.Type, &ch.Name, &ch.Config, &ch.Enabled, &ch.CreatedAt, &ch.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan notification channel: %w", err)
		}
		channels = append(channels, ch)
	}
	return channels, nil
}

func (r *PostgresChannelRepository) Update(id int, ch *Channel) error {
	query := `UPDATE notification_channels SET type = $1, name = $2, config = $3, enabled = $4, updated_at = $5
		WHERE id = $6`

	ch.UpdatedAt = time.Now()
	result, err := r.DB.Exec(query, ch.Type, ch.Name, ch.Config, ch.Enabled, ch.UpdatedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update notification channel: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("notification channel not found")
	}
	return nil
}

func (r *PostgresChannelRepository) Delete(id int) error {
	query := `DELETE FROM notification_channels WHERE id = $1`
	result, err := r.DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete notification channel: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("notification channel not found")
	}
	return nil
}

type PostgresRoutingRuleRepository struct {
	DB *sql.DB
}

func (r *PostgresRoutingRuleRepository) List() ([]RoutingRule, error) {
	query := `SELECT id, severity, channel_ids, created_at, updated_at
		FROM notification_routing_rules ORDER BY id`

	rows, err := r.DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to list routing rules: %w", err)
	}
	defer func() { _ = rows.Close() }()

	rules := make([]RoutingRule, 0)
	for rows.Next() {
		var rule RoutingRule
		if err := rows.Scan(&rule.ID, &rule.Severity, &rule.ChannelIDs, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan routing rule: %w", err)
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func (r *PostgresRoutingRuleRepository) Update(id int, rule *RoutingRule) error {
	query := `UPDATE notification_routing_rules SET channel_ids = $1, updated_at = $2 WHERE id = $3`
	rule.UpdatedAt = time.Now()

	result, err := r.DB.Exec(query, rule.ChannelIDs, rule.UpdatedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update routing rule: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("routing rule not found")
	}
	return nil
}

func (r *PostgresRoutingRuleRepository) GetBySeverity(severity string) (*RoutingRule, error) {
	query := `SELECT id, severity, channel_ids, created_at, updated_at
		FROM notification_routing_rules WHERE severity = $1`

	var rule RoutingRule
	err := r.DB.QueryRow(query, severity).Scan(
		&rule.ID, &rule.Severity, &rule.ChannelIDs, &rule.CreatedAt, &rule.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("routing rule not found for severity: %s", severity)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get routing rule: %w", err)
	}
	return &rule, nil
}
