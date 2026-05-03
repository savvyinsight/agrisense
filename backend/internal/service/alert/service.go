package alert

import (
	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type Service struct {
	alertRepo  domain.AlertRepository
	ruleRepo   domain.AlertRuleRepository
	deviceRepo domain.DeviceRepository
}

func NewService(
	alertRepo domain.AlertRepository,
	ruleRepo domain.AlertRuleRepository,
	deviceRepo domain.DeviceRepository,
) *Service {
	return &Service{
		alertRepo:  alertRepo,
		ruleRepo:   ruleRepo,
		deviceRepo: deviceRepo,
	}
}

func (s *Service) CreateRule(rule *domain.AlertRule) error {
	return s.ruleRepo.Create(rule)
}

func (s *Service) UpdateRule(rule *domain.AlertRule) error {
	return s.ruleRepo.Update(rule)
}

func (s *Service) DeleteRule(id int) error {
	return s.ruleRepo.Delete(id)
}

func (s *Service) GetRule(id int) (*domain.AlertRule, error) {
	return s.ruleRepo.GetByID(id)
}

func (s *Service) ListRules(userID int) ([]domain.AlertRule, error) {
	return s.ruleRepo.List(userID)
}

func (s *Service) GetActiveAlerts() ([]domain.Alert, error) {
	return s.alertRepo.GetActive()
}

func (s *Service) GetActiveAlertsPaginated(page, limit int) ([]domain.Alert, int64, error) {
	offset := (page - 1) * limit
	return s.alertRepo.GetActivePaginated(limit, offset)
}

func (s *Service) GetAlertsByDevice(deviceID int) ([]domain.Alert, error) {
	return s.alertRepo.GetByDeviceID(deviceID)
}

func (s *Service) AcknowledgeAlert(alertID int) error {
	return s.alertRepo.Acknowledge(alertID)
}

func (s *Service) ResolveAlert(alertID int) error {
	return s.alertRepo.Resolve(alertID)
}

func (s *Service) GetAlertHistory(page, limit int) ([]domain.Alert, int64, error) {
	offset := (page - 1) * limit
	return s.alertRepo.List(limit, offset)
}
