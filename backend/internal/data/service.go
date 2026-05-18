package data

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/savvyinsight/agrisense/internal/automation"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/ruleengine"
	"github.com/savvyinsight/agrisense/internal/sensor"
)

type Service struct {
	sensorTypeRepo sensor.SensorTypeRepository
	deviceRepo     device.DeviceRepository
	cacheRepo      sensor.CacheRepository
	influxRepo     sensor.InfluxRepository
	ruleEngine     *ruleengine.Engine
	automationSvc  *automation.Service
	fieldRepo      field.FieldRepository
}

func NewService(
	sensorTypeRepo sensor.SensorTypeRepository,
	deviceRepo device.DeviceRepository,
	cacheRepo sensor.CacheRepository,
	influxRepo sensor.InfluxRepository,
	ruleEngine *ruleengine.Engine,
	fieldRepo field.FieldRepository,
) *Service {
	return &Service{
		sensorTypeRepo: sensorTypeRepo,
		deviceRepo:     deviceRepo,
		cacheRepo:      cacheRepo,
		influxRepo:     influxRepo,
		ruleEngine:     ruleEngine,
		fieldRepo:      fieldRepo,
	}
}

func (s *Service) SetAutomationService(automationSvc *automation.Service) {
	s.automationSvc = automationSvc
}

func (s *Service) ProcessTelemetry(deviceID string, payload []byte) error {
	var telemetryData struct {
		Timestamp string `json:"timestamp"`
		Readings  []struct {
			Sensor string  `json:"sensor"`
			Value  float64 `json:"value"`
		} `json:"readings"`
	}

	var sensorData []sensor.SensorData
	timestamp := time.Now()

	if err := json.Unmarshal(payload, &telemetryData); err != nil {
		// Fallback: try simple key-value format for compatibility
		var readings map[string]float64
		if err2 := json.Unmarshal(payload, &readings); err2 != nil {
			return fmt.Errorf("failed to unmarshal telemetry: %w", err)
		}
		for sensorType, value := range readings {
			sensorData = append(sensorData, sensor.SensorData{
				DeviceID: deviceID, SensorType: sensorType,
				Value: value, Timestamp: timestamp,
			})
		}
	} else {
		if telemetryData.Timestamp != "" {
			if parsedTime, err := time.Parse(time.RFC3339, telemetryData.Timestamp); err == nil {
				timestamp = parsedTime
			}
		}
		for _, reading := range telemetryData.Readings {
			sensorData = append(sensorData, sensor.SensorData{
				DeviceID: deviceID, SensorType: reading.Sensor,
				Value: reading.Value, Timestamp: timestamp,
			})
		}
	}

	if err := s.influxRepo.WriteBatch(sensorData); err != nil {
		return err
	}

	// Update field-level aggregates from the latest telemetry
	s.updateFieldFromTelemetry(deviceID, sensorData)

	// Evaluate each sensor reading against active alert rules
	if s.ruleEngine != nil {
		for _, reading := range sensorData {
			s.ruleEngine.Evaluate(&reading)
		}
	}

	return nil
}

func (s *Service) updateFieldFromTelemetry(deviceID string, readings []sensor.SensorData) {
	if s.fieldRepo == nil {
		return
	}
	dev, err := s.deviceRepo.GetByDeviceID(deviceID)
	if err != nil || dev.FieldID == nil {
		return
	}

	var moisture, temperature, humidity *float64
	for _, r := range readings {
		switch r.SensorType {
		case "soil_moisture":
			v := r.Value
			moisture = &v
		case "temperature":
			v := r.Value
			temperature = &v
		case "humidity":
			v := r.Value
			humidity = &v
		}
	}

	if moisture == nil && temperature == nil && humidity == nil {
		return
	}

	// Read existing field data first to preserve values not in this telemetry batch
	existing, err := s.fieldRepo.GetByID(*dev.FieldID)
	if err != nil {
		log.Printf("Failed to get field %d: %v", *dev.FieldID, err)
		return
	}

	m := 0.0
	if moisture != nil {
		m = *moisture
	} else if existing.SoilMoisture != nil {
		m = *existing.SoilMoisture
	}

	t := 0.0
	if temperature != nil {
		t = *temperature
	} else if existing.Temperature != nil {
		t = *existing.Temperature
	}

	h := 0.0
	if humidity != nil {
		h = *humidity
	} else if existing.Humidity != nil {
		h = *existing.Humidity
	}

	if err := s.fieldRepo.UpdateSensorData(*dev.FieldID, m, t, h); err != nil {
		log.Printf("Failed to update field %d sensor data: %v", *dev.FieldID, err)
	}
}

func (s *Service) GetLatestReading(deviceID, sensorType string) (*sensor.SensorData, error) {
	// Get data from last 24 hours and return the latest
	start := time.Now().Add(-24 * time.Hour)
	end := time.Now()

	data, err := s.influxRepo.Query(deviceID, sensorType, start, end)
	if err != nil {
		return nil, err
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("no data found")
	}

	// Return the last one (most recent)
	return &data[len(data)-1], nil
}

func (s *Service) GetHistoricalData(deviceID, sensorType string, start, end time.Time) ([]sensor.SensorData, error) {
	return s.influxRepo.Query(deviceID, sensorType, start, end)
}

func (s *Service) GetLatestReadingsForDevices(deviceIDs []string, sensorType string) (map[string]sensor.SensorData, error) {
	result := make(map[string]sensor.SensorData)
	start := time.Now().Add(-24 * time.Hour)
	end := time.Now()

	for _, deviceID := range deviceIDs {
		data, err := s.influxRepo.Query(deviceID, sensorType, start, end)
		if err != nil {
			log.Printf("Error querying data for device %s: %v", deviceID, err)
			continue
		}
		if len(data) > 0 {
			result[deviceID] = data[len(data)-1]
		}
	}

	return result, nil
}

func (s *Service) GetAggregatedData(deviceID, sensorType string, start, end time.Time, interval string) ([]sensor.AggregatedData, error) {
	return s.influxRepo.QueryAggregate(deviceID, sensorType, start, end, interval)
}
