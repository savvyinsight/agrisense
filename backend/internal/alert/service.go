package alert

import (
	"fmt"
	"log"

	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
)

type Service struct {
	alertRepo  AlertRepository
	ruleRepo   AlertRuleRepository
	deviceRepo device.DeviceRepository
	fieldRepo  field.FieldRepository
}

func NewService(
	alertRepo AlertRepository,
	ruleRepo AlertRuleRepository,
	deviceRepo device.DeviceRepository,
	fieldRepo field.FieldRepository,
) *Service {
	return &Service{
		alertRepo:  alertRepo,
		ruleRepo:   ruleRepo,
		deviceRepo: deviceRepo,
		fieldRepo:  fieldRepo,
	}
}

// recomputeFieldHealth queries active alerts for the field and updates its health.
func (s *Service) recomputeFieldHealth(deviceID int) error {
	dev, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return fmt.Errorf("get device %d: %w", deviceID, err)
	}
	if dev.FieldID == nil {
		return nil
	}

	activeAlerts, err := s.alertRepo.GetActiveAlertsByField(*dev.FieldID)
	if err != nil {
		return fmt.Errorf("get active alerts for field %d: %w", *dev.FieldID, err)
	}

	health := field.FieldHealthHealthy
	for _, a := range activeAlerts {
		if a.Severity == SeverityCritical {
			health = field.FieldHealthCritical
			break
		}
		if a.Severity == SeverityWarning && health != field.FieldHealthCritical {
			health = field.FieldHealthWarning
		}
	}

	return s.fieldRepo.UpdateHealth(*dev.FieldID, health)
}

func (s *Service) CreateRule(rule *AlertRule) error {
	return s.ruleRepo.Create(rule)
}

func (s *Service) UpdateRule(rule *AlertRule) error {
	return s.ruleRepo.Update(rule)
}

func (s *Service) DeleteRule(id int) error {
	return s.ruleRepo.Delete(id)
}

func (s *Service) GetRule(id int) (*AlertRule, error) {
	return s.ruleRepo.GetByID(id)
}

func (s *Service) ListRules(userID int) ([]AlertRule, error) {
	return s.ruleRepo.List(userID)
}

func (s *Service) GetActiveAlerts() ([]Alert, error) {
	return s.alertRepo.GetActive()
}

func (s *Service) GetActiveAlertsPaginated(page, limit int) ([]Alert, int64, error) {
	offset := (page - 1) * limit
	return s.alertRepo.GetActivePaginated(limit, offset)
}

func (s *Service) GetAlertsByDevice(deviceID int) ([]Alert, error) {
	return s.alertRepo.GetByDeviceID(deviceID)
}

func (s *Service) AcknowledgeAlert(alertID int) error {
	a, err := s.alertRepo.GetByID(alertID)
	if err != nil {
		return fmt.Errorf("get alert %d: %w", alertID, err)
	}
	if err := s.alertRepo.Acknowledge(alertID); err != nil {
		return err
	}
	if s.fieldRepo != nil {
		if err := s.recomputeFieldHealth(a.DeviceID); err != nil {
			log.Printf("Failed to recompute field health after acknowledge: %v", err)
		}
	}
	return nil
}

func (s *Service) ResolveAlert(alertID int) error {
	a, err := s.alertRepo.GetByID(alertID)
	if err != nil {
		return fmt.Errorf("get alert %d: %w", alertID, err)
	}
	if err := s.alertRepo.Resolve(alertID); err != nil {
		return err
	}
	if s.fieldRepo != nil {
		if err := s.recomputeFieldHealth(a.DeviceID); err != nil {
			log.Printf("Failed to recompute field health after resolve: %v", err)
		}
	}
	return nil
}

func (s *Service) GetAlertHistory(page, limit int) ([]Alert, int64, error) {
	offset := (page - 1) * limit
	return s.alertRepo.List(limit, offset)
}
