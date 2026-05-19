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
		// Only triggered alerts affect field health — acknowledged means handled
		if a.Status != AlertStatusTriggered {
			continue
		}
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
	// Check if rule is being disabled
	existing, err := s.ruleRepo.GetByID(rule.ID)
	if err != nil {
		return fmt.Errorf("get existing rule %d: %w", rule.ID, err)
	}
	if err := s.ruleRepo.Update(rule); err != nil {
		return err
	}
	// If rule was enabled and is now disabled, resolve its active alerts
	if existing.Enabled && !rule.Enabled {
		if err := s.resolveAlertsByRuleID(rule.ID); err != nil {
			log.Printf("Failed to resolve alerts for disabled rule %d: %v", rule.ID, err)
		}
	}
	return nil
}

func (s *Service) DeleteRule(id int) error {
	// Resolve all active alerts before deleting the rule
	if err := s.resolveAlertsByRuleID(id); err != nil {
		log.Printf("Failed to resolve alerts for deleted rule %d: %v", id, err)
	}
	return s.ruleRepo.Delete(id)
}

func (s *Service) resolveAlertsByRuleID(ruleID int) error {
	deviceIDs, err := s.alertRepo.ResolveByRuleID(ruleID)
	if err != nil {
		return fmt.Errorf("resolve alerts for rule %d: %w", ruleID, err)
	}
	// Recompute field health for each affected device
	for _, devID := range deviceIDs {
		if err := s.recomputeFieldHealth(devID); err != nil {
			log.Printf("Failed to recompute field health for device %d: %v", devID, err)
		}
	}
	return nil
}

func (s *Service) GetRule(id int) (*AlertRule, error) {
	return s.ruleRepo.GetByID(id)
}

func (s *Service) ListRules(userID int) ([]AlertRule, error) {
	return s.ruleRepo.List(userID)
}

func (s *Service) enrichAlert(a *Alert) {
	if a == nil {
		return
	}
	if s.deviceRepo != nil {
		dev, err := s.deviceRepo.GetByID(a.DeviceID)
		if err == nil && dev != nil {
			a.DeviceIDStr = dev.DeviceID
			a.DeviceName = dev.Name
			a.FieldID = dev.FieldID
		}
	}
	if s.ruleRepo != nil {
		rule, err := s.ruleRepo.GetByID(a.RuleID)
		if err == nil && rule != nil {
			a.RuleName = rule.Name
		}
	}
}

func (s *Service) enrichAlerts(alerts []Alert) []Alert {
	for i := range alerts {
		s.enrichAlert(&alerts[i])
	}
	return alerts
}

func (s *Service) GetActiveAlerts() ([]Alert, error) {
	alerts, err := s.alertRepo.GetActive()
	if err != nil {
		return nil, err
	}
	return s.enrichAlerts(alerts), nil
}

func (s *Service) GetActiveAlertsPaginated(page, limit int) ([]Alert, int64, error) {
	offset := (page - 1) * limit
	alerts, total, err := s.alertRepo.GetActivePaginated(limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return s.enrichAlerts(alerts), total, nil
}

func (s *Service) GetAlertsByDevice(deviceID int) ([]Alert, error) {
	alerts, err := s.alertRepo.GetByDeviceID(deviceID)
	if err != nil {
		return nil, err
	}
	return s.enrichAlerts(alerts), nil
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
	alerts, total, err := s.alertRepo.List(limit, offset)
	if err != nil {
		return nil, 0, err
	}
	return s.enrichAlerts(alerts), total, nil
}

func (s *Service) GetAlertByID(id int) (*Alert, error) {
	a, err := s.alertRepo.GetByID(id)
	if err != nil {
		return nil, err
	}
	s.enrichAlert(a)
	return a, nil
}
