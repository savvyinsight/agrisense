package benchmark

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/mqtt"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
)

// ── Benchmark: Topic Parsing ─────────────────────────────────────────────

func BenchmarkExtractDeviceIDFromTopic(b *testing.B) {
	topics := []string{
		"device/sensor-001/telemetry",
		"device/CTRL-NTH/commands",
		"device/sensor-100/heartbeat",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mqtt.ExtractDeviceIDFromTopic(topics[i%len(topics)])
	}
}

// ── Benchmark: Telemetry JSON Unmarshal ──────────────────────────────────

func BenchmarkTelemetryUnmarshal_Structured(b *testing.B) {
	payload := generateTelemetryJSON("sensor-001", "temperature", 23.45)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var td struct {
			Timestamp string `json:"timestamp"`
			Readings  []struct {
				Sensor string  `json:"sensor"`
				Value  float64 `json:"value"`
			} `json:"readings"`
		}
		if err := json.Unmarshal(payload, &td); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkTelemetryUnmarshal_Simple(b *testing.B) {
	payload := []byte(`{"temperature":23.45,"humidity":65.2}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var readings map[string]float64
		if err := json.Unmarshal(payload, &readings); err != nil {
			b.Fatal(err)
		}
	}
}

// ── Benchmark: Telemetry JSON Marshal ────────────────────────────────────

func BenchmarkTelemetryMarshal(b *testing.B) {
	type reading struct {
		Sensor string  `json:"sensor"`
		Value  float64 `json:"value"`
	}
	type payload struct {
		Timestamp string    `json:"timestamp"`
		Readings  []reading `json:"readings"`
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		p := payload{
			Timestamp: time.Now().UTC().Format(time.RFC3339),
			Readings: []reading{
				{Sensor: "temperature", Value: math.Round(23.456*100) / 100},
			},
		}
		if _, err := json.Marshal(p); err != nil {
			b.Fatal(err)
		}
	}
}

// ── Benchmark: ProcessTelemetry (with mock repos) ────────────────────────

func BenchmarkProcessTelemetry(b *testing.B) {
	svc := data.NewService(
		&noopSensorTypeRepo{},
		&noopDeviceRepo{},
		&noopCacheRepo{},
		&noopInfluxRepo{},
		nil, // ruleEngine
		nil, // fieldRepo
	)

	payload := generateTelemetryJSON("sensor-001", "temperature", 23.45)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := svc.ProcessTelemetry("sensor-001", payload); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkProcessTelemetry_MultiSensor(b *testing.B) {
	svc := data.NewService(
		&noopSensorTypeRepo{},
		&noopDeviceRepo{},
		&noopCacheRepo{},
		&noopInfluxRepo{},
		nil,
		nil,
	)

	payload := generateMultiSensorJSON("sensor-001")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := svc.ProcessTelemetry("sensor-001", payload); err != nil {
			b.Fatal(err)
		}
	}
}

// ── Benchmark: Generate Telemetry (simulator hot path) ───────────────────

func BenchmarkGenerateTelemetryJSON(b *testing.B) {
	sensors := []string{"temperature", "humidity", "soil_moisture", "light_intensity"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		generateTelemetryJSON("sensor-001", sensors[i%len(sensors)], rand.Float64()*100)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────

func generateTelemetryJSON(deviceID, sensorType string, value float64) []byte {
	p := map[string]interface{}{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"readings": []map[string]interface{}{
			{"sensor": sensorType, "value": math.Round(value*100) / 100},
		},
		"metadata": map[string]interface{}{
			"device_id":        deviceID,
			"firmware_version": "1.2.3",
		},
	}
	b, _ := json.Marshal(p)
	return b
}

func generateMultiSensorJSON(deviceID string) []byte {
	p := map[string]interface{}{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"readings": []map[string]interface{}{
			{"sensor": "temperature", "value": 23.5},
			{"sensor": "humidity", "value": 65.2},
			{"sensor": "soil_moisture", "value": 42.1},
			{"sensor": "light_intensity", "value": 5500.0},
		},
	}
	b, _ := json.Marshal(p)
	return b
}

// ── Noop Mock Repositories ───────────────────────────────────────────────

// noopSensorTypeRepo
type noopSensorTypeRepo struct{}

func (r *noopSensorTypeRepo) GetSensorTypeByName(name string) (*sensor.SensorType, error) {
	return nil, fmt.Errorf("not found")
}
func (r *noopSensorTypeRepo) GetSensorTypes() ([]sensor.SensorType, error) { return nil, nil }
func (r *noopSensorTypeRepo) GetSensorTypeByID(id int) (*sensor.SensorType, error) {
	return nil, fmt.Errorf("not found")
}

// noopDeviceRepo
type noopDeviceRepo struct{}

func (r *noopDeviceRepo) Create(d *device.Device) error          { return nil }
func (r *noopDeviceRepo) GetByID(id int) (*device.Device, error) { return nil, fmt.Errorf("not found") }
func (r *noopDeviceRepo) GetByDeviceID(deviceID string) (*device.Device, error) {
	return &device.Device{DeviceID: deviceID}, nil
}
func (r *noopDeviceRepo) GetByUserID(userID int) ([]device.Device, error) { return nil, nil }
func (r *noopDeviceRepo) Update(d *device.Device) error                   { return nil }
func (r *noopDeviceRepo) Delete(id, accountID int) error                  { return nil }
func (r *noopDeviceRepo) UpdateStatus(deviceID string, status device.DeviceStatus) error {
	return nil
}
func (r *noopDeviceRepo) UpdateHeartbeat(deviceID string) error { return nil }
func (r *noopDeviceRepo) List(accountID, userID int, filter device.DeviceFilter, limit, offset int) ([]device.Device, int64, error) {
	return nil, 0, nil
}
func (r *noopDeviceRepo) FindOrCreate(deviceID string) (*device.Device, error) {
	return &device.Device{DeviceID: deviceID}, nil
}
func (r *noopDeviceRepo) ClaimDevice(deviceID string, userID, accountID int) error  { return nil }
func (r *noopDeviceRepo) UnclaimDevice(deviceID string) error                       { return nil }
func (r *noopDeviceRepo) MarkOfflineByHeartbeat(timeout time.Duration) (int, error) { return 0, nil }

// noopCacheRepo
type noopCacheRepo struct{}

func (r *noopCacheRepo) SetJSON(key string, value interface{}, ttl time.Duration) error {
	return nil
}
func (r *noopCacheRepo) GetJSON(key string, dest interface{}) error {
	return fmt.Errorf("not found")
}
func (r *noopCacheRepo) Delete(key string) error                              { return nil }
func (r *noopCacheRepo) SetDeviceStatus(deviceID string, status string) error { return nil }
func (r *noopCacheRepo) GetDeviceStatus(deviceID string) (string, error)      { return "", nil }

// noopInfluxRepo
type noopInfluxRepo struct{}

func (r *noopInfluxRepo) WriteData(data *sensor.SensorData) error   { return nil }
func (r *noopInfluxRepo) WriteBatch(data []sensor.SensorData) error { return nil }
func (r *noopInfluxRepo) Query(deviceID, sensorType string, start, end time.Time) ([]sensor.SensorData, error) {
	return nil, nil
}
func (r *noopInfluxRepo) QueryAggregate(deviceID, sensorType string, start, end time.Time, interval string) ([]sensor.AggregatedData, error) {
	return nil, nil
}
func (r *noopInfluxRepo) QueryVerification(start, end time.Time) ([]sensor.SensorData, error) {
	return nil, nil
}

// Verify interfaces are satisfied at compile time
var _ sensor.SensorTypeRepository = (*noopSensorTypeRepo)(nil)
var _ device.DeviceRepository = (*noopDeviceRepo)(nil)
var _ sensor.CacheRepository = (*noopCacheRepo)(nil)
var _ sensor.InfluxRepository = (*noopInfluxRepo)(nil)
var _ field.FieldRepository = (*noopFieldRepo)(nil)

type noopFieldRepo struct{}

func (r *noopFieldRepo) Create(f *field.Field) error            { return nil }
func (r *noopFieldRepo) GetByID(id int) (*field.Field, error)   { return nil, fmt.Errorf("not found") }
func (r *noopFieldRepo) List(userID int) ([]field.Field, error) { return nil, nil }
func (r *noopFieldRepo) Update(f *field.Field) error            { return nil }
func (r *noopFieldRepo) Delete(id int) error                    { return nil }
func (r *noopFieldRepo) UpdateSensorData(fieldID int, moisture, temperature, humidity float64) error {
	return nil
}
func (r *noopFieldRepo) UpdateHealth(fieldID int, health field.FieldHealth) error { return nil }

// Ensure ruleengine is referenced (used by data.NewService)
var _ *ruleengine.Engine
