package escalation

import "fmt"

type Service struct {
	ruleRepo    EscalationRuleRepository
	historyRepo EscalationHistoryRepository
}

func NewService(ruleRepo EscalationRuleRepository, historyRepo EscalationHistoryRepository) *Service {
	return &Service{
		ruleRepo:    ruleRepo,
		historyRepo: historyRepo,
	}
}

func (s *Service) CreateRule(rule *EscalationRule) error {
	if rule.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if rule.TriggerSeverity == "" {
		return fmt.Errorf("trigger severity is required")
	}
	if len(rule.Levels) == 0 {
		return fmt.Errorf("at least one escalation level is required")
	}
	return s.ruleRepo.Create(rule)
}

func (s *Service) GetRule(id int) (*EscalationRule, error) {
	return s.ruleRepo.GetByID(id)
}

func (s *Service) ListRules(accountID int) ([]EscalationRule, error) {
	return s.ruleRepo.List(accountID)
}

func (s *Service) UpdateRule(id int, rule *EscalationRule) error {
	if rule.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if len(rule.Levels) == 0 {
		return fmt.Errorf("at least one escalation level is required")
	}
	return s.ruleRepo.Update(id, rule)
}

func (s *Service) DeleteRule(id int, accountID int) error {
	return s.ruleRepo.Delete(id, accountID)
}

func (s *Service) GetHistory(alertID int) ([]EscalationHistoryEntry, error) {
	return s.historyRepo.GetByAlertID(alertID)
}
