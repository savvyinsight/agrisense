package analytics

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type Service struct {
	dataService *dataServiceAdapter
	deviceRepo  domain.DeviceRepository
	sensorRepo  domain.SensorTypeRepository
}

// dataServiceAdapter is a thin wrapper to avoid dependency cycle on service/data package.
type dataServiceAdapter struct {
	getHistorical func(deviceUID string, sensorType string, start, end time.Time) ([]domain.SensorData, error)
}

func NewService(
	deviceRepo domain.DeviceRepository,
	sensorRepo domain.SensorTypeRepository,
	getHistorical func(deviceUID string, sensorType string, start, end time.Time) ([]domain.SensorData, error),
) *Service {
	return &Service{
		deviceRepo:  deviceRepo,
		sensorRepo:  sensorRepo,
		dataService: &dataServiceAdapter{getHistorical: getHistorical},
	}
}

func (s *Service) GenerateReport(deviceID int, start, end time.Time, reportType string) (*domain.AnalyticsReport, error) {
	if end.Before(start) {
		return nil, fmt.Errorf("end time must be after start time")
	}

	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}

	sensorTypes, err := s.sensorRepo.GetSensorTypes()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch sensor types: %w", err)
	}

	reportType = strings.ToLower(reportType)
	if reportType == "" {
		reportType = "daily"
	}

	result := &domain.AnalyticsReport{
		DeviceID:   deviceID,
		DeviceUID:  device.DeviceID,
		Start:      start,
		End:        end,
		ReportType: reportType,
	}

	for _, sensorType := range sensorTypes {
		rawData, err := s.dataService.getHistorical(device.DeviceID, sensorType.Name, start, end)
		if err != nil {
			return nil, fmt.Errorf("failed to query sensor data for %s: %w", sensorType.Name, err)
		}

		aggregated := s.aggregateSensorData(rawData, reportType)
		if len(aggregated) == 0 {
			continue
		}

		result.SensorReports = append(result.SensorReports, domain.SensorAnalyticsReport{
			SensorType: sensorType.Name,
			Unit:       sensorType.Unit,
			Data:       aggregated,
		})
	}

	return result, nil
}

func (s *Service) aggregateSensorData(data []domain.SensorData, reportType string) []domain.SensorAnalyticsData {
	if len(data) == 0 {
		return nil
	}

	group := map[time.Time][]domain.SensorData{}

	for _, point := range data {
		t := point.Timestamp.UTC()
		var bucket time.Time

		switch reportType {
		case "daily":
			bucket = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		case "weekly":
			weekday := int(t.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			bucket = time.Date(t.Year(), t.Month(), t.Day()-weekday+1, 0, 0, 0, 0, time.UTC)
		case "monthly":
			bucket = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
		default:
			bucket = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
		}

		group[bucket] = append(group[bucket], point)
	}

	var keys []time.Time
	for k := range group {
		keys = append(keys, k)
	}
	// sort by time
	sort.Slice(keys, func(i, j int) bool { return keys[i].Before(keys[j]) })

	aggregated := make([]domain.SensorAnalyticsData, 0, len(keys))
	for _, bucket := range keys {
		points := group[bucket]
		if len(points) == 0 {
			continue
		}

		minV := points[0].Value
		maxV := points[0].Value
		sum := 0.0
		for _, p := range points {
			if p.Value < minV {
				minV = p.Value
			}
			if p.Value > maxV {
				maxV = p.Value
			}
			sum += p.Value
		}

		aggregated = append(aggregated, domain.SensorAnalyticsData{
			Timestamp: bucket,
			Avg:       sum / float64(len(points)),
			Min:       minV,
			Max:       maxV,
			Count:     len(points),
		})
	}

	return aggregated
}
