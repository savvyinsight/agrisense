package data

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/savvyinsight/agrisenseiot/internal/ruleengine"
	"github.com/savvyinsight/agrisenseiot/internal/service/automation"
)

type Service struct {
	sensorTypeRepo domain.SensorTypeRepository
	deviceRepo     domain.DeviceRepository
	cacheRepo      domain.CacheRepository
	influxRepo     domain.InfluxRepository
	ruleEngine     *ruleengine.Engine
	automationSvc  *automation.Service
}

func NewService(
	sensorTypeRepo domain.SensorTypeRepository,
	deviceRepo domain.DeviceRepository,
	cacheRepo domain.CacheRepository,
	influxRepo domain.InfluxRepository,
	ruleEngine *ruleengine.Engine,
) *Service {
	return &Service{
		sensorTypeRepo: sensorTypeRepo,
		deviceRepo:     deviceRepo,
		cacheRepo:      cacheRepo,
		influxRepo:     influxRepo,
		ruleEngine:     ruleEngine,
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

	if err := json.Unmarshal(payload, &telemetryData); err != nil {
		// Fallback: try simple key-value format for compatibility
		var readings map[string]float64
		if err2 := json.Unmarshal(payload, &readings); err2 != nil {
			return fmt.Errorf("failed to unmarshal telemetry: %w", err)
		}
		// Process as simple key-value map
		timestamp := time.Now()
		var sensorData []domain.SensorData
		for sensorType, value := range readings {
			sensorData = append(sensorData, domain.SensorData{
				DeviceID:   deviceID,
				SensorType: sensorType,
				Value:      value,
				Timestamp:  timestamp,
			})
		}
		return s.influxRepo.WriteBatch(sensorData)
	}

	// Parse timestamp if provided, otherwise use now
	timestamp := time.Now()
	if telemetryData.Timestamp != "" {
		if parsedTime, err := time.Parse(time.RFC3339, telemetryData.Timestamp); err == nil {
			timestamp = parsedTime
		}
	}

	var sensorData []domain.SensorData
	for _, reading := range telemetryData.Readings {
		sensorData = append(sensorData, domain.SensorData{
			DeviceID:   deviceID,
			SensorType: reading.Sensor,
			Value:      reading.Value,
			Timestamp:  timestamp,
		})
	}

	return s.influxRepo.WriteBatch(sensorData)
}

func (s *Service) GetLatestReading(deviceID, sensorType string) (*domain.SensorData, error) {
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

func (s *Service) GetHistoricalData(deviceID, sensorType string, start, end time.Time) ([]domain.SensorData, error) {
	return s.influxRepo.Query(deviceID, sensorType, start, end)
}

func (s *Service) GetLatestReadingsForDevices(deviceIDs []string, sensorType string) (map[string]domain.SensorData, error) {
	result := make(map[string]domain.SensorData)
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

func (s *Service) GetAggregatedData(deviceID, sensorType string, start, end time.Time, interval string) ([]domain.AggregatedData, error) {
	return s.influxRepo.QueryAggregate(deviceID, sensorType, start, end, interval)
}
