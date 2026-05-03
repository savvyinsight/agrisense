package influxdb

import (
	"context"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

func (r *Repository) WriteData(data *domain.SensorData) error {
	writeAPI := r.client.WriteAPIBlocking(r.org, r.bucket)

	point := influxdb2.NewPoint(
		"sensor_data",
		map[string]string{
			"device_id":   data.DeviceID,
			"sensor_type": data.SensorType,
		},
		map[string]interface{}{
			"value": data.Value,
		},
		data.Timestamp,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return writeAPI.WritePoint(ctx, point)
}

func (r *Repository) WriteBatch(data []domain.SensorData) error {
	writeAPI := r.client.WriteAPIBlocking(r.org, r.bucket)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, d := range data {
		point := influxdb2.NewPoint(
			"sensor_data",
			map[string]string{
				"device_id":   d.DeviceID,
				"sensor_type": d.SensorType,
			},
			map[string]interface{}{
				"value": d.Value,
			},
			d.Timestamp,
		)

		if err := writeAPI.WritePoint(ctx, point); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) Query(deviceID string, sensorType string, start, end time.Time) ([]domain.SensorData, error) {
	queryAPI := r.client.QueryAPI(r.org)

	flux := fmt.Sprintf(`
        from(bucket: "%s")
            |> range(start: %s, stop: %s)
            |> filter(fn: (r) => r._measurement == "sensor_data")
            |> filter(fn: (r) => r.device_id == "%s")
            |> filter(fn: (r) => r.sensor_type == "%s")
            |> filter(fn: (r) => r._field == "value")
            |> sort(columns: ["_time"], desc: false)
    `, r.bucket, start.Format(time.RFC3339), end.Format(time.RFC3339), deviceID, sensorType)

	result, err := queryAPI.Query(context.Background(), flux)
	if err != nil {
		return nil, fmt.Errorf("failed to query InfluxDB: %w", err)
	}

	var data []domain.SensorData
	for result.Next() {
		record := result.Record()
		data = append(data, domain.SensorData{
			DeviceID:   deviceID,
			SensorType: sensorType,
			Value:      record.Value().(float64),
			Timestamp:  record.Time(),
		})
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return data, nil
}

func (r *Repository) QueryAggregate(deviceID string, sensorType string, start, end time.Time, interval string) ([]domain.AggregatedData, error) {
	queryAPI := r.client.QueryAPI(r.org)

	flux := fmt.Sprintf(`
        from(bucket: "%s")
            |> range(start: %s, stop: %s)
            |> filter(fn: (r) => r._measurement == "sensor_data")
            |> filter(fn: (r) => r.device_id == "%s")
            |> filter(fn: (r) => r.sensor_type == "%s")
            |> filter(fn: (r) => r._field == "value")
            |> aggregateWindow(every: %s, fn: mean)
            |> yield(name: "mean")
    `, r.bucket, start.Format(time.RFC3339), end.Format(time.RFC3339), deviceID, sensorType, interval)

	result, err := queryAPI.Query(context.Background(), flux)
	if err != nil {
		return nil, fmt.Errorf("failed to query InfluxDB: %w", err)
	}

	var data []domain.AggregatedData
	for result.Next() {
		record := result.Record()

		// Handle potential nil values
		val := record.Value()
		if val == nil {
			continue
		}

		avg, ok := val.(float64)
		if !ok {
			continue
		}

		data = append(data, domain.AggregatedData{
			Timestamp: record.Time(),
			Avg:       avg,
		})
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return data, nil
}

func (r *Repository) GetSensorTypeByName(name string) (*domain.SensorType, error) {
	// This would actually come from PostgreSQL, not InfluxDB
	// For now, return mock data - will be replaced with PostgreSQL repo call
	sensorTypes := map[string]domain.SensorType{
		"temperature":     {ID: 1, Name: "temperature", Unit: "°C", MinValue: -40, MaxValue: 80},
		"humidity":        {ID: 2, Name: "humidity", Unit: "%", MinValue: 0, MaxValue: 100},
		"soil_moisture":   {ID: 3, Name: "soil_moisture", Unit: "%", MinValue: 0, MaxValue: 100},
		"light_intensity": {ID: 4, Name: "light_intensity", Unit: "lux", MinValue: 0, MaxValue: 100000},
	}

	sensor, exists := sensorTypes[name]
	if !exists {
		return nil, fmt.Errorf("sensor type %s not found", name)
	}
	return &sensor, nil
}
