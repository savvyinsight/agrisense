package automation

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/savvyinsight/agrisense/internal/control"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

type Service struct {
	automationRepo AutomationRuleRepository
	deviceRepo     device.DeviceRepository
	commandService CommandExecutor
	scheduler      *Scheduler

	mu           sync.Mutex
	lastExecuted map[int]time.Time
}

type CommandExecutor interface {
	ExecuteCommand(deviceID int, command string, parameters map[string]interface{}, userID *int) (*control.Command, error)
}

type Scheduler struct {
	rules       map[int]*AutomationRule
	stopChan    chan struct{}
	executeFunc func(rule *AutomationRule)
}

func NewService(
	automationRepo AutomationRuleRepository,
	deviceRepo device.DeviceRepository,
	commandExecutor CommandExecutor,
) *Service {
	return &Service{
		automationRepo: automationRepo,
		deviceRepo:     deviceRepo,
		commandService: commandExecutor,
		lastExecuted:   make(map[int]time.Time),
		scheduler:      &Scheduler{rules: make(map[int]*AutomationRule), stopChan: make(chan struct{})},
	}
}

func (s *Service) Start() error {
	log.Println("Starting automation service...")

	// Load enabled rules
	if err := s.loadRules(); err != nil {
		return fmt.Errorf("failed to load automation rules: %w", err)
	}

	// Start scheduler for cron-based rules
	s.scheduler.executeFunc = func(rule *AutomationRule) {
		s.executeAutomationRule(rule, nil)
	}
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

	s.scheduler.rules = make(map[int]*AutomationRule)
	for _, rule := range rules {
		s.scheduler.rules[rule.ID] = &rule
	}

	log.Printf("Loaded %d automation rules", len(rules))
	return nil
}

func (s *Service) CreateRule(rule *AutomationRule) error {
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
		if err := s.loadRules(); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) GetRulesByUser(userID int) ([]AutomationRule, error) {
	return s.automationRepo.GetByUserID(userID)
}

func (s *Service) GetRuleByID(id int) (*AutomationRule, error) {
	return s.automationRepo.GetByID(id)
}

func (s *Service) UpdateRule(rule *AutomationRule) error {
	// Validate the rule
	if err := s.validateRule(rule); err != nil {
		return err
	}

	rule.UpdatedAt = time.Now()

	if err := s.automationRepo.Update(rule); err != nil {
		return err
	}

	// Reload rules
	if err := s.loadRules(); err != nil {
		return err
	}

	return nil
}

func (s *Service) DeleteRule(id int) error {
	if err := s.automationRepo.Delete(id); err != nil {
		return err
	}

	// Reload rules
	if err := s.loadRules(); err != nil {
		return err
	}

	return nil
}

func (s *Service) EvaluateSensorRule(data *sensor.SensorData) {
	// Find automation rules that might be triggered by this sensor data
	// For now, we'll check all enabled rules (can be optimized later)
	for _, rule := range s.scheduler.rules {
		if rule.TriggerType != TriggerTypeSensor {
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

func (s *Service) evaluateCondition(condition AutomationCondition, actualValue, thresholdValue float64) bool {
	switch condition {
	case AutomationConditionGT:
		return actualValue > thresholdValue
	case AutomationConditionLT:
		return actualValue < thresholdValue
	case AutomationConditionEQ:
		return actualValue == thresholdValue
	case AutomationConditionGTE:
		return actualValue >= thresholdValue
	case AutomationConditionLTE:
		return actualValue <= thresholdValue
	default:
		return false
	}
}

func (s *Service) executeAutomationRule(rule *AutomationRule, triggerData *sensor.SensorData) {
	// Dedup: skip if this rule was executed within the cooldown period
	cooldown := time.Duration(rule.TriggerDurationSeconds) * time.Second
	if cooldown == 0 {
		cooldown = 5 * time.Minute
	}
	s.mu.Lock()
	last, ok := s.lastExecuted[rule.ID]
	if ok && time.Since(last) < cooldown {
		s.mu.Unlock()
		return
	}
	s.lastExecuted[rule.ID] = time.Now()
	s.mu.Unlock()

	if triggerData != nil {
		log.Printf("Executing automation rule: %s (triggered by %s: %.2f)",
			rule.Name, triggerData.SensorType, triggerData.Value)
	} else {
		log.Printf("Executing scheduled automation rule: %s", rule.Name)
	}

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

	// Broadcast via WebSocket to the rule owner
	if rule.UserID > 0 {
		wsMsg := map[string]interface{}{
			"type": "automation_executed",
			"payload": map[string]interface{}{
				"rule_id":           rule.ID,
				"rule_name":         rule.Name,
				"target_device_id":  rule.TargetDeviceID,
				"action_command":    rule.ActionCommand,
				"action_parameters": rule.ActionParameters,
				"command_id":        command.ID,
				"trigger_type":      rule.TriggerType,
			},
		}
		wsHub := websocket.GetHub()
		wsHub.BroadcastToUser(rule.UserID, wsMsg)
	}
}

func (s *Service) validateRule(rule *AutomationRule) error {
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

	switch rule.TriggerType {
	case TriggerTypeSensor:
		if rule.TriggerSensorTypeID == nil {
			return fmt.Errorf("trigger sensor type ID is required for sensor triggers")
		}
		if rule.TriggerValue == nil {
			return fmt.Errorf("trigger value is required for sensor triggers")
		}
	case TriggerTypeSchedule:
		if rule.ScheduleCron == nil || *rule.ScheduleCron == "" {
			return fmt.Errorf("schedule cron is required for schedule triggers")
		}
	default:
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

func (s *Service) PauseRule(id int) error {
	rule, err := s.automationRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("rule not found: %w", err)
	}
	rule.Paused = true
	if err := s.automationRepo.Update(rule); err != nil {
		return err
	}
	return s.loadRules()
}

func (s *Service) ResumeRule(id int) error {
	rule, err := s.automationRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("rule not found: %w", err)
	}
	rule.Paused = false
	if err := s.automationRepo.Update(rule); err != nil {
		return err
	}
	return s.loadRules()
}

func (s *Service) ExecuteNow(id int) (*control.Command, error) {
	rule, err := s.automationRepo.GetByID(id)
	if err != nil {
		return nil, fmt.Errorf("rule not found: %w", err)
	}

	if !rule.Enabled {
		return nil, fmt.Errorf("rule is disabled")
	}

	cmd, err := s.commandService.ExecuteCommand(
		rule.TargetDeviceID,
		rule.ActionCommand,
		rule.ActionParameters,
		&rule.UserID,
	)
	if err != nil {
		_ = s.automationRepo.UpdateLastCommandStatus(id, "failed")
		return nil, fmt.Errorf("failed to execute command: %w", err)
	}

	_ = s.automationRepo.IncrementExecutionCount(id)
	_ = s.automationRepo.UpdateLastTriggered(id)
	_ = s.automationRepo.UpdateLastCommandStatus(id, string(cmd.Status))

	return cmd, nil
}

type AutomationDashboardData struct {
	TotalRules            int                      `json:"total_rules"`
	ActiveRules           int                      `json:"active_rules"`
	PausedRules           int                      `json:"paused_rules"`
	FailedRules           int                      `json:"failed_rules"`
	RecentExecutions      []map[string]interface{} `json:"recent_executions"`
	FieldSummaries        []map[string]interface{} `json:"field_summaries"`
	GlobalAutomationEnabled bool                   `json:"global_automation_enabled"`
}

func (s *Service) GetDashboard(userID int) (*AutomationDashboardData, error) {
	rules, err := s.automationRepo.GetByUserID(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rules: %w", err)
	}

	globalEnabled, err := s.automationRepo.GetGlobalAutomationEnabled()
	if err != nil {
		globalEnabled = true // default
	}

	data := &AutomationDashboardData{
		GlobalAutomationEnabled: globalEnabled,
	}

	for _, rule := range rules {
		data.TotalRules++
		if rule.Paused {
			data.PausedRules++
		} else if rule.Enabled {
			data.ActiveRules++
		}
		if rule.LastCommandStatus != nil && *rule.LastCommandStatus == "failed" {
			data.FailedRules++
		}
	}

	// Get recent executions from all rules
	recentExecs := make([]map[string]interface{}, 0)
	for _, rule := range rules {
		cmds, err := s.automationRepo.GetCommandHistory(rule.ID, 5)
		if err != nil {
			continue
		}
		for _, cmd := range cmds {
			cmd["rule_name"] = rule.Name
			cmd["rule_id"] = rule.ID
			recentExecs = append(recentExecs, cmd)
		}
	}
	data.RecentExecutions = recentExecs
	data.FieldSummaries = []map[string]interface{}{}

	return data, nil
}

func (s *Service) SetGlobalAutomation(enabled bool) error {
	return s.automationRepo.SetGlobalAutomationEnabled(enabled)
}

func (s *Service) GetCommandHistory(ruleID int, limit int) ([]map[string]interface{}, error) {
	return s.automationRepo.GetCommandHistory(ruleID, limit)
}

// Scheduler handles cron-based automation rules
func (s *Scheduler) start() {
	log.Println("Starting automation scheduler...")

	// Check every minute for scheduled rules
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run an immediate check on startup
	s.checkScheduledRules()

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
		if rule.TriggerType != TriggerTypeSchedule {
			continue
		}

		if rule.ScheduleCron == nil {
			continue
		}

		if !s.isScheduledTime(*rule.ScheduleCron, now, rule.Timezone) {
			continue
		}

		log.Printf("Executing scheduled automation rule: %s", rule.Name)
		if s.executeFunc != nil {
			s.executeFunc(rule)
		}
	}
}

func (s *Scheduler) isScheduledTime(cronExpr string, now time.Time, timezone string) bool {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		log.Printf("Failed to parse cron expression %q: %v", cronExpr, err)
		return false
	}

	loc := time.UTC
	if timezone != "" {
		if l, err := time.LoadLocation(timezone); err == nil {
			loc = l
		} else {
			log.Printf("Invalid timezone %q for cron rule, using UTC", timezone)
		}
	}

	nowInLoc := now.In(loc)
	prev := schedule.Next(nowInLoc.Add(-2 * time.Minute))
	next := schedule.Next(prev)

	// Check if the current time falls within the execution window
	// (within 1 minute of the scheduled time, matching our ticker interval)
	return !next.After(nowInLoc) && nowInLoc.Sub(next) < time.Minute
}
