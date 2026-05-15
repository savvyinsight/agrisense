package device

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

type PostgresDeviceRepository struct {
	DB *sql.DB
}

func (r *PostgresDeviceRepository) Create(device *Device) error {
	query := `
        INSERT INTO devices (device_id, name, type, location, latitude, longitude, status, firmware_version, config, field_id, user_id, account_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
    `

	configJSON, err := json.Marshal(device.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	err = r.DB.QueryRow(
		query,
		device.DeviceID,
		device.Name,
		device.Type,
		device.Location,
		device.Latitude,
		device.Longitude,
		device.Status,
		device.FirmwareVersion,
		configJSON,
		device.FieldID,
		device.UserID,
		device.AccountID,
		time.Now(),
		time.Now(),
	).Scan(&device.ID)

	return err
}

func (r *PostgresDeviceRepository) GetByID(id int) (*Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, field_id, user_id, created_at, updated_at
        FROM devices WHERE id = $1
    `

	var device Device
	var configJSON []byte
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64

	err := r.DB.QueryRow(query, id).Scan(
		&device.ID,
		&device.DeviceID,
		&device.Name,
		&device.Type,
		&device.Location,
		&latitude,
		&longitude,
		&device.Status,
		&device.LastHeartbeat,
		&device.FirmwareVersion,
		&configJSON,
		&device.FieldID,
		&device.UserID,
		&device.CreatedAt,
		&device.UpdatedAt,
	)

	if latitude.Valid {
		device.Latitude = &latitude.Float64
	}
	if longitude.Valid {
		device.Longitude = &longitude.Float64
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("device not found")
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(configJSON, &device.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &device, nil
}

func (r *PostgresDeviceRepository) GetByDeviceID(deviceID string) (*Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, field_id, user_id, created_at, updated_at
        FROM devices WHERE device_id = $1
    `

	var device Device
	var configJSON []byte
	var latitude sql.NullFloat64
	var longitude sql.NullFloat64

	err := r.DB.QueryRow(query, deviceID).Scan(
		&device.ID,
		&device.DeviceID,
		&device.Name,
		&device.Type,
		&device.Location,
		&latitude,
		&longitude,
		&device.Status,
		&device.LastHeartbeat,
		&device.FirmwareVersion,
		&configJSON,
		&device.FieldID,
		&device.UserID,
		&device.CreatedAt,
		&device.UpdatedAt,
	)

	if latitude.Valid {
		device.Latitude = &latitude.Float64
	}
	if longitude.Valid {
		device.Longitude = &longitude.Float64
	}

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("device not found")
	}
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(configJSON, &device.Config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &device, nil
}

func (r *PostgresDeviceRepository) FindOrCreate(deviceID string, userID int) (*Device, error) {
	existing, err := r.GetByDeviceID(deviceID)
	if err == nil {
		return existing, nil
	}

	device := &Device{
		DeviceID: deviceID,
		Name:     "Device " + deviceID,
		Type:     DeviceTypeSensor,
		Status:   DeviceStatusOnline,
		UserID:   userID,
	}

	if err := r.Create(device); err != nil {
		return nil, err
	}
	return device, nil
}

func (r *PostgresDeviceRepository) ClaimDevice(deviceID string, userID, accountID int) error {
	result, err := r.DB.Exec(`
		UPDATE devices SET user_id = $1, account_id = $2, updated_at = NOW()
		WHERE device_id = $3 AND (user_id = 1 OR account_id IS NULL)
	`, userID, accountID, deviceID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("device already claimed by another user")
	}
	return nil
}

func (r *PostgresDeviceRepository) UnclaimDevice(deviceID string) error {
	_, err := r.DB.Exec(`
		UPDATE devices SET user_id = 1, account_id = NULL, updated_at = NOW()
		WHERE device_id = $1
	`, deviceID)
	return err
}

func (r *PostgresDeviceRepository) GetByUserID(userID int) ([]Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, field_id, user_id, created_at, updated_at
        FROM devices WHERE user_id = $1 ORDER BY id
    `

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	var devices []Device
	for rows.Next() {
		var device Device
		var configJSON []byte
		var latitude sql.NullFloat64
		var longitude sql.NullFloat64

		err := rows.Scan(
			&device.ID,
			&device.DeviceID,
			&device.Name,
			&device.Type,
			&device.Location,
			&latitude,
			&longitude,
			&device.Status,
			&device.LastHeartbeat,
			&device.FirmwareVersion,
			&configJSON,
			&device.FieldID,
			&device.UserID,
			&device.CreatedAt,
			&device.UpdatedAt,
		)

		if latitude.Valid {
			device.Latitude = &latitude.Float64
		}
		if longitude.Valid {
			device.Longitude = &longitude.Float64
		}
		if err != nil {
			return nil, err
		}

		if len(configJSON) > 0 {
			if err := json.Unmarshal(configJSON, &device.Config); err != nil {
				return nil, fmt.Errorf("failed to unmarshal device config: %w", err)
			}
		}
		devices = append(devices, device)
	}

	return devices, nil
}

func (r *PostgresDeviceRepository) Update(device *Device) error {
	query := `
        UPDATE devices 
        SET name = $1, type = $2, location = $3, latitude = $4, longitude = $5, status = $6, 
            firmware_version = $7, config = $8, field_id = $9, updated_at = $10
        WHERE id = $11
    `

	configJSON, err := json.Marshal(device.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	_, err = r.DB.Exec(
		query,
		device.Name,
		device.Type,
		device.Location,
		device.Latitude,
		device.Longitude,
		device.Status,
		device.FirmwareVersion,
		configJSON,
		device.FieldID,
		time.Now(),
		device.ID,
	)

	return err
}

func (r *PostgresDeviceRepository) UpdateHeartbeat(deviceID string) error {
	query := `UPDATE devices SET last_heartbeat = $1, updated_at = $2 WHERE device_id = $3`
	_, err := r.DB.Exec(query, time.Now(), time.Now(), deviceID)
	return err
}

func (r *PostgresDeviceRepository) UpdateStatus(deviceID string, status DeviceStatus) error {
	query := `UPDATE devices SET status = $1, updated_at = $2 WHERE device_id = $3`
	_, err := r.DB.Exec(query, status, time.Now(), deviceID)
	return err
}

func (r *PostgresDeviceRepository) List(userID int, limit, offset int) ([]Device, int64, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, field_id, user_id, created_at, updated_at
        FROM devices 
        WHERE user_id = $1 OR $1 = 0
        ORDER BY id 
        LIMIT $2 OFFSET $3
    `

	rows, err := r.DB.Query(query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			_ = err
		}
	}()

	devices := make([]Device, 0)
	for rows.Next() {
		var device Device
		var configJSON []byte
		var latitude sql.NullFloat64
		var longitude sql.NullFloat64
		err := rows.Scan(
			&device.ID,
			&device.DeviceID,
			&device.Name,
			&device.Type,
			&device.Location,
			&latitude,
			&longitude,
			&device.Status,
			&device.LastHeartbeat,
			&device.FirmwareVersion,
			&configJSON,
			&device.FieldID,
			&device.UserID,
			&device.CreatedAt,
			&device.UpdatedAt,
		)

		if latitude.Valid {
			device.Latitude = &latitude.Float64
		}
		if longitude.Valid {
			device.Longitude = &longitude.Float64
		}
		if err != nil {
			return nil, 0, err
		}
		if len(configJSON) > 0 {
			if err := json.Unmarshal(configJSON, &device.Config); err != nil {
				return nil, 0, fmt.Errorf("failed to unmarshal device config: %w", err)
			}
		}
		devices = append(devices, device)
	}

	var total int64
	countQuery := `SELECT COUNT(*) FROM devices WHERE user_id = $1 OR $1 = 0`
	err = r.DB.QueryRow(countQuery, userID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	return devices, total, nil
}

func (r *PostgresDeviceRepository) Delete(id int) error {
	query := `DELETE FROM devices WHERE id = $1`
	result, err := r.DB.Exec(query, id)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return fmt.Errorf("device with id %d not found", id)
	}

	return nil
}
