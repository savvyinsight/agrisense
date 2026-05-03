package automation

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type Service struct {
	automationRepo domain.AutomationRuleRepository
	deviceRepo     domain.DeviceRepository
	commandService CommandExecutor
	scheduler      *Scheduler
}

type CommandExecutor interface {
	ExecuteCommand(deviceID int, command string, parameters map[string]interface{}, userID *int) (*domain.Command, error)
}

type Scheduler struct {
	rules    map[int]*domain.AutomationRule
	stopChan chan struct{}
}

func NewService(
	automationRepo domain.AutomationRuleRepository,
	deviceRepo domain.DeviceRepository,
	commandExecutor CommandExecutor,
) *Service {
	return &Service{
		automationRepo: automationRepo,
		deviceRepo:     deviceRepo,
		commandService: commandExecutor,
		scheduler:      &Scheduler{rules: make(map[int]*domain.AutomationRule), stopChan: make(chan struct{})},
	}
}

func (s *Service) Start() error {
	log.Println("Starting automation service...")

	// Load enabled rules
	if err := s.loadRules(); err != nil {
		return fmt.Errorf("failed to load automation rules: %w", err)
	}

	// Start scheduler for cron-based rules
	go s.scheduler.start()

	return nil
}

func (s *Service) Stop() {
	close(s.scheduler.stopChan)
}

func (s *Service) loadRules() error {
	rules, err := s.automationRepo.GetEnabledRules()
	if err != nil {
		return err
	}

	s.scheduler.rules = make(map[int]*domain.AutomationRule)
	for _, rule := range rules {
		s.scheduler.rules[rule.ID] = &rule
	}

	log.Printf("Loaded %d automation rules", len(rules))
	return nil
}

func (s *Service) CreateRule(rule *domain.AutomationRule) error {
	// Validate the rule
	if err := s.validateRule(rule); err != nil {
		return err
	}

	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()

	if err := s.automationRepo.Create(rule); err != nil {
		return err
	}

	// Reload rules if enabled
	if rule.Enabled {
		s.loadRules()
	}

	return nil
}

func (s *Service) GetRulesByUser(userID int) ([]domain.AutomationRule, error) {
	return s.automationRepo.GetByUserID(userID)
}

func (s *Service) GetRuleByID(id int) (*domain.AutomationRule, error) {
	return s.automationRepo.GetByID(id)
}

func (s *Service) UpdateRule(rule *domain.AutomationRule) error {
	// Validate the rule
	if err := s.validateRule(rule); err != nil {
		return err
	}

	rule.UpdatedAt = time.Now()

	if err := s.automationRepo.Update(rule); err != nil {
		return err
	}

	// Reload rules
	s.loadRules()

	return nil
}

func (s *Service) DeleteRule(id int) error {
	if err := s.automationRepo.Delete(id); err != nil {
		return err
	}

	// Reload rules
	s.loadRules()

	return nil
}

func (s *Service) EvaluateSensorRule(data *domain.SensorData) {
	// Find automation rules that might be triggered by this sensor data
	// For now, we'll check all enabled rules (can be optimized later)
	for _, rule := range s.scheduler.rules {
		if rule.TriggerType != domain.TriggerTypeSensor {
			continue
		}

		// Check if this rule applies to this sensor type
		if rule.TriggerSensorTypeID == nil {
			continue
		}

		// Get sensor type ID from sensor name (this should be cached)
		sensorTypeID := s.getSensorTypeID(data.SensorType)
		if sensorTypeID != *rule.TriggerSensorTypeID {
			continue
		}

		// For now, implement simple threshold evaluation
		// TODO: Add duration-based evaluation
		if s.evaluateCondition(rule.TriggerCondition, data.Value, *rule.TriggerValue) {
			s.executeAutomationRule(rule, data)
		}
	}
}

func (s *Service) evaluateCondition(condition domain.AutomationCondition, actualValue, thresholdValue float64) bool {
	switch condition {
	case domain.AutomationConditionGT:
		return actualValue > thresholdValue
	case domain.AutomationConditionLT:
		return actualValue < thresholdValue
	case domain.AutomationConditionEQ:
		return actualValue == thresholdValue
	case domain.AutomationConditionGTE:
		return actualValue >= thresholdValue
	case domain.AutomationConditionLTE:
		return actualValue <= thresholdValue
	default:
		return false
	}
}

func (s *Service) executeAutomationRule(rule *domain.AutomationRule, triggerData *domain.SensorData) {
	log.Printf("Executing automation rule: %s (triggered by %s: %.2f)",
		rule.Name, triggerData.SensorType, triggerData.Value)

	// Execute the command
	command, err := s.commandService.ExecuteCommand(
		rule.TargetDeviceID,
		rule.ActionCommand,
		rule.ActionParameters,
		&rule.UserID,
	)

	if err != nil {
		log.Printf("Failed to execute automation command for rule %d: %v", rule.ID, err)
		return
	}

	log.Printf("Automation command executed: %s on device %d (command ID: %d)",
		rule.ActionCommand, rule.TargetDeviceID, command.ID)
}

func (s *Service) validateRule(rule *domain.AutomationRule) error {
	if rule.Name == "" {
		return fmt.Errorf("rule name is required")
	}

	if rule.TargetDeviceID == 0 {
		return fmt.Errorf("target device ID is required")
	}

	// Verify target device exists
	_, err := s.deviceRepo.GetByID(rule.TargetDeviceID)
	if err != nil {
		return fmt.Errorf("target device not found: %w", err)
	}

	if rule.TriggerType == domain.TriggerTypeSensor {
		if rule.TriggerSensorTypeID == nil {
			return fmt.Errorf("trigger sensor type ID is required for sensor triggers")
		}
		if rule.TriggerValue == nil {
			return fmt.Errorf("trigger value is required for sensor triggers")
		}
	} else if rule.TriggerType == domain.TriggerTypeSchedule {
		if rule.ScheduleCron == nil || *rule.ScheduleCron == "" {
			return fmt.Errorf("schedule cron is required for schedule triggers")
		}
	} else {
		return fmt.Errorf("invalid trigger type")
	}

	if rule.ActionCommand == "" {
		return fmt.Errorf("action command is required")
	}

	return nil
}

func (s *Service) getSensorTypeID(sensorType string) int {
	// This should be cached/mapped from sensor_type_repo
	// For now, hardcode common types
	switch sensorType {
	case "temperature":
		return 1
	case "humidity":
		return 2
	case "soil_moisture":
		return 3
	case "light_intensity":
		return 4
	default:
		return 0
	}
}

// Scheduler handles cron-based automation rules
func (s *Scheduler) start() {
	log.Println("Starting automation scheduler...")

	// Check every minute for scheduled rules
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.checkScheduledRules()
		case <-s.stopChan:
			log.Println("Stopping automation scheduler...")
			return
		}
	}
}

func (s *Scheduler) checkScheduledRules() {
	now := time.Now()

	for _, rule := range s.rules {
		if rule.TriggerType != domain.TriggerTypeSchedule {
			continue
		}

		if rule.ScheduleCron == nil {
			continue
		}

		// Simple cron parsing (for now, just check if it's time)
		// TODO: Implement proper cron parsing
		if s.isScheduledTime(*rule.ScheduleCron, now, rule.Timezone) {
			log.Printf("Executing scheduled automation rule: %s", rule.Name)
			// Note: We need access to the service to execute
			// This is a simplified implementation
		}
	}
}

func (s *Scheduler) isScheduledTime(cronExpr string, now time.Time, timezone string) bool {
	// Very basic implementation - check if current minute matches
	// TODO: Implement proper cron parsing (consider using a cron library)
	parts := strings.Split(cronExpr, " ")
	if len(parts) < 5 {
		return false
	}

	// For now, just return false to avoid executing scheduled rules
	// This needs proper cron implementation
	return false
}
