package postgres

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type DeviceRepository struct {
	DB *sql.DB
}

func (r *DeviceRepository) Create(device *domain.Device) error {
	query := `
        INSERT INTO devices (device_id, name, type, location, latitude, longitude, status, firmware_version, config, user_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
		device.UserID,
		time.Now(),
		time.Now(),
	).Scan(&device.ID)

	return err
}

func (r *DeviceRepository) GetByID(id int) (*domain.Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, user_id, created_at, updated_at
        FROM devices WHERE id = $1
    `

	var device domain.Device
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

func (r *DeviceRepository) GetByDeviceID(deviceID string) (*domain.Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, user_id, created_at, updated_at
        FROM devices WHERE device_id = $1
    `

	var device domain.Device
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

func (r *DeviceRepository) GetByUserID(userID int) ([]domain.Device, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, user_id, created_at, updated_at
        FROM devices WHERE user_id = $1 ORDER BY id
    `

	rows, err := r.DB.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []domain.Device
	for rows.Next() {
		var device domain.Device
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
			json.Unmarshal(configJSON, &device.Config)
		}
		devices = append(devices, device)
	}

	return devices, nil
}

func (r *DeviceRepository) Update(device *domain.Device) error {
	query := `
        UPDATE devices 
        SET name = $1, type = $2, location = $3, latitude = $4, longitude = $5, status = $6, 
            firmware_version = $7, config = $8, updated_at = $9
        WHERE id = $10
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
		time.Now(),
		device.ID,
	)

	return err
}

func (r *DeviceRepository) UpdateHeartbeat(deviceID string) error {
	query := `UPDATE devices SET last_heartbeat = $1, updated_at = $2 WHERE device_id = $3`
	_, err := r.DB.Exec(query, time.Now(), time.Now(), deviceID)
	return err
}

func (r *DeviceRepository) UpdateStatus(deviceID string, status domain.DeviceStatus) error {
	query := `UPDATE devices SET status = $1, updated_at = $2 WHERE device_id = $3`
	_, err := r.DB.Exec(query, status, time.Now(), deviceID)
	return err
}

func (r *DeviceRepository) List(userID int, limit, offset int) ([]domain.Device, int64, error) {
	query := `
        SELECT id, device_id, name, type, location, latitude, longitude, status, last_heartbeat, 
               firmware_version, config, user_id, created_at, updated_at
        FROM devices 
        WHERE user_id = $1 OR $1 = 0
        ORDER BY id 
        LIMIT $2 OFFSET $3
    `

	rows, err := r.DB.Query(query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var devices []domain.Device
	for rows.Next() {
		var device domain.Device
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
			json.Unmarshal(configJSON, &device.Config)
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

func (r *DeviceRepository) Delete(id int) error {
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
