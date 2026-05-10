package control

import (
	"database/sql"
	"encoding/json"
	"time"
)

type PostgresCommandRepository struct {
	DB *sql.DB
}

func (r *PostgresCommandRepository) Create(cmd *Command) error {
	query := `
        INSERT INTO control_commands (
            device_id, command, parameters, status, created_at, user_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
    `

	parametersJSON, err := json.Marshal(cmd.Parameters)
	if err != nil {
		return err
	}

	metadataJSON, err := json.Marshal(cmd.Metadata)
	if err != nil {
		return err
	}

	now := time.Now()
	err = r.DB.QueryRow(
		query,
		cmd.DeviceID,
		cmd.Command,
		parametersJSON,
		cmd.Status,
		now,
		cmd.UserID,
		metadataJSON,
	).Scan(&cmd.ID)

	cmd.CreatedAt = now
	return err
}

func (r *PostgresCommandRepository) GetByID(id int) (*Command, error) {
	query := `
        SELECT id, device_id, command, parameters, status, created_at, 
               sent_at, delivered_at, executed_at, user_id, metadata
        FROM control_commands WHERE id = $1
    `

	var cmd Command
	var parametersJSON []byte
	var metadataJSON []byte

	err := r.DB.QueryRow(query, id).Scan(
		&cmd.ID,
		&cmd.DeviceID,
		&cmd.Command,
		&parametersJSON,
		&cmd.Status,
		&cmd.CreatedAt,
		&cmd.SentAt,
		&cmd.DeliveredAt,
		&cmd.ExecutedAt,
		&cmd.UserID,
		&metadataJSON,
	)

	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(parametersJSON, &cmd.Parameters); err != nil {
		return nil, err
	}

	if len(metadataJSON) > 0 {
		if err := json.Unmarshal(metadataJSON, &cmd.Metadata); err != nil {
			return nil, err
		}
	}

	return &cmd, nil
}

func (r *PostgresCommandRepository) GetByDeviceID(deviceID int, limit int) ([]Command, error) {
	query := `
        SELECT id, device_id, command, parameters, status, created_at, 
               sent_at, delivered_at, executed_at, user_id, metadata
        FROM control_commands 
        WHERE device_id = $1
        ORDER BY created_at DESC
        LIMIT $2
    `

	rows, err := r.DB.Query(query, deviceID, limit)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var commands []Command
	for rows.Next() {
		var cmd Command
		var parametersJSON []byte
		var metadataJSON []byte

		err := rows.Scan(
			&cmd.ID,
			&cmd.DeviceID,
			&cmd.Command,
			&parametersJSON,
			&cmd.Status,
			&cmd.CreatedAt,
			&cmd.SentAt,
			&cmd.DeliveredAt,
			&cmd.ExecutedAt,
			&cmd.UserID,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(parametersJSON, &cmd.Parameters); err != nil {
			return nil, err
		}
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &cmd.Metadata); err != nil {
				return nil, err
			}
		}

		commands = append(commands, cmd)
	}

	return commands, nil
}

func (r *PostgresCommandRepository) UpdateStatus(id int, status CommandStatus) error {
	query := `UPDATE control_commands SET status = $1 WHERE id = $2`
	_, err := r.DB.Exec(query, status, id)
	return err
}

func (r *PostgresCommandRepository) UpdateDelivery(id int, sentAt, deliveredAt, executedAt *time.Time) error {
	query := `
        UPDATE control_commands 
        SET sent_at = $1, delivered_at = $2, executed_at = $3, status = $4
        WHERE id = $5
    `

	status := CommandStatusPending
	switch {
	case executedAt != nil:
		status = CommandStatusExecuted
	case deliveredAt != nil:
		status = CommandStatusDelivered
	case sentAt != nil:
		status = CommandStatusSent
	}

	_, err := r.DB.Exec(query, sentAt, deliveredAt, executedAt, status, id)
	return err
}

func (r *PostgresCommandRepository) GetPending(deviceID int) ([]Command, error) {
	query := `
        SELECT id, device_id, command, parameters, status, created_at, 
               sent_at, delivered_at, executed_at, user_id, metadata
        FROM control_commands 
        WHERE device_id = $1 AND status IN ('pending', 'sent')
        ORDER BY created_at ASC
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

	var commands []Command
	for rows.Next() {
		var cmd Command
		var parametersJSON []byte
		var metadataJSON []byte

		err := rows.Scan(
			&cmd.ID,
			&cmd.DeviceID,
			&cmd.Command,
			&parametersJSON,
			&cmd.Status,
			&cmd.CreatedAt,
			&cmd.SentAt,
			&cmd.DeliveredAt,
			&cmd.ExecutedAt,
			&cmd.UserID,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(parametersJSON, &cmd.Parameters); err != nil {
			return nil, err
		}
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &cmd.Metadata); err != nil {
				return nil, err
			}
		}

		commands = append(commands, cmd)
	}

	return commands, nil
}
