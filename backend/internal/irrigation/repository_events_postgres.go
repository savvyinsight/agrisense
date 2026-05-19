package irrigation

import (
	"database/sql"
	"fmt"
	"time"
)

type PostgresIrrigationEventRepository struct {
	DB *sql.DB
}

func (r *PostgresIrrigationEventRepository) Create(event *IrrigationEvent) error {
	query := `INSERT INTO irrigation_events
		(zone_id, field_id, device_id, status, start_time, trigger_type, triggered_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		RETURNING id, created_at`
	return r.DB.QueryRow(query,
		event.ZoneID, event.FieldID, event.DeviceID,
		event.Status, event.StartTime, event.TriggerType, event.TriggeredBy,
	).Scan(&event.ID, &event.CreatedAt)
}

func (r *PostgresIrrigationEventRepository) CompleteLatestRunning(zoneID int, endTime time.Time, duration int, waterUsage float64) error {
	query := `UPDATE irrigation_events
		SET status = 'completed', end_time = $1, duration_minutes = $2, water_usage_liters = $3
		WHERE id = (
			SELECT id FROM irrigation_events
			WHERE zone_id = $4 AND status = 'running'
			ORDER BY start_time DESC LIMIT 1
		)`
	result, err := r.DB.Exec(query, endTime, duration, waterUsage, zoneID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("no running event found for zone %d", zoneID)
	}
	return nil
}

func (r *PostgresIrrigationEventRepository) ListByZoneID(zoneID int, limit int) ([]IrrigationEvent, error) {
	query := `SELECT id, zone_id, field_id, device_id, status, start_time, end_time,
	       duration_minutes, water_usage_liters, trigger_type, triggered_by, created_at
		FROM irrigation_events WHERE zone_id = $1
		ORDER BY start_time DESC LIMIT $2`
	return r.scanEvents(query, zoneID, limit)
}

func (r *PostgresIrrigationEventRepository) ListByFieldID(fieldID int, limit int) ([]IrrigationEvent, error) {
	query := `SELECT id, zone_id, field_id, device_id, status, start_time, end_time,
	       duration_minutes, water_usage_liters, trigger_type, triggered_by, created_at
		FROM irrigation_events WHERE field_id = $1
		ORDER BY start_time DESC LIMIT $2`
	return r.scanEvents(query, fieldID, limit)
}

func (r *PostgresIrrigationEventRepository) scanEvents(query string, arg int, limit int) ([]IrrigationEvent, error) {
	rows, err := r.DB.Query(query, arg, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var events []IrrigationEvent
	for rows.Next() {
		var e IrrigationEvent
		var devID, triggeredBy sql.NullInt64
		var endTime sql.NullTime
		err := rows.Scan(
			&e.ID, &e.ZoneID, &e.FieldID, &devID, &e.Status,
			&e.StartTime, &endTime, &e.DurationMinutes, &e.WaterUsageLiters,
			&e.TriggerType, &triggeredBy, &e.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		if devID.Valid { v := int(devID.Int64); e.DeviceID = &v }
		if endTime.Valid { e.EndTime = &endTime.Time }
		if triggeredBy.Valid { v := int(triggeredBy.Int64); e.TriggeredBy = &v }
		events = append(events, e)
	}
	if events == nil {
		events = []IrrigationEvent{}
	}
	return events, nil
}
