package alert

import (
	"github.com/savvyinsight/agrisense/internal/device"
)

type Service struct {
	alertRepo  AlertRepository
	ruleRepo   AlertRuleRepository
	deviceRepo device.DeviceRepository
}

func NewService(
	alertRepo AlertRepository,
	ruleRepo AlertRuleRepository,
	deviceRepo device.DeviceRepository,
) *Service {
	return &Service{
		alertRepo:  alertRepo,
		ruleRepo:   ruleRepo,
		deviceRepo: deviceRepo,
	}
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
	return s.alertRepo.Acknowledge(alertID)
}

func (s *Service) ResolveAlert(alertID int) error {
	return s.alertRepo.Resolve(alertID)
}

func (s *Service) GetAlertHistory(page, limit int) ([]Alert, int64, error) {
	offset := (page - 1) * limit
	return s.alertRepo.List(limit, offset)
}
