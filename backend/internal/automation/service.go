package automation

import (
	"fmt"
	"log"
	"math"
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
	sensorTypeRepo sensor.SensorTypeRepository
	scheduler      *Scheduler

	mu              sync.Mutex
	lastExecuted    map[int]time.Time
	sensorTypeCache map[string]int

	globalMu                sync.RWMutex
	globalAutomationEnabled bool
}

type CommandExecutor interface {
	ExecuteCommand(deviceID int, command string, parameters map[string]interface{}, userID *int, onStatusChange func(commandID int, status string)) (*control.Command, error)
}

type Scheduler struct {
	rules       map[int]*AutomationRule
	stopChan    chan struct{}
	executeFunc func(rule *AutomationRule)
	lastFired   map[int]time.Time // rule ID -> last fired scheduled time
}

func NewService(
	automationRepo AutomationRuleRepository,
	deviceRepo device.DeviceRepository,
	commandExecutor CommandExecutor,
	sensorTypeRepo sensor.SensorTypeRepository,
) *Service {
	s := &Service{
		automationRepo:          automationRepo,
		deviceRepo:              deviceRepo,
		commandService:          commandExecutor,
		sensorTypeRepo:          sensorTypeRepo,
		lastExecuted:            make(map[int]time.Time),
		sensorTypeCache:         make(map[string]int),
		globalAutomationEnabled: true,
		scheduler:               &Scheduler{rules: make(map[int]*AutomationRule), stopChan: make(chan struct{}), lastFired: make(map[int]time.Time)},
	}
	s.loadSensorTypeCache()
	return s
}

func (s *Service) Start() error {
	log.Println("Starting automation service...")

	// Load enabled rules
	if err := s.loadRules(); err != nil {
		return fmt.Errorf("failed to load automation rules: %w", err)
	}

	// Refresh sensor type cache
	s.loadSensorTypeCache()

	// Load global automation setting
	enabled, err := s.automationRepo.GetGlobalAutomationEnabled()
	if err != nil {
		log.Printf("Warning: failed to get global automation setting, defaulting to enabled: %v", err)
		enabled = true
	}
	s.globalAutomationEnabled = enabled

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
	rules, err := s.automationRepo.GetEnabledRules(0)
	if err != nil {
		return err
	}

	s.scheduler.rules = make(map[int]*AutomationRule)
	for _, rule := range rules {
		s.scheduler.rules[rule.ID] = &rule
	}

	// Restore cooldown state from persisted last_triggered_at
	s.mu.Lock()
	for _, rule := range rules {
		if rule.LastTriggeredAt != nil {
			s.lastExecuted[rule.ID] = *rule.LastTriggeredAt
		}
	}
	s.mu.Unlock()

	log.Printf("Loaded %d automation rules", len(rules))
	return nil
}

func (s *Service) loadSensorTypeCache() {
	sensorTypes, err := s.sensorTypeRepo.GetSensorTypes()
	if err != nil {
		log.Printf("Warning: failed to load sensor types: %v", err)
		return
	}
	for _, st := range sensorTypes {
		s.sensorTypeCache[st.Name] = st.ID
	}
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

func (s *Service) GetRulesByUser(userID, accountID int) ([]AutomationRule, error) {
	return s.automationRepo.GetByUserID(userID, accountID)
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

func (s *Service) DeleteRule(id, accountID int) error {
	if err := s.automationRepo.Delete(id, accountID); err != nil {
		return err
	}

	// Reload rules
	if err := s.loadRules(); err != nil {
		return err
	}

	return nil
}

func (s *Service) EvaluateSensorRule(data *sensor.SensorData) {
	// Look up device to determine account ownership
	dev, err := s.deviceRepo.GetByDeviceID(data.DeviceID)
	if err != nil {
		log.Printf("Device %s not found for sensor evaluation: %v", data.DeviceID, err)
		return
	}
	if dev.AccountID == nil {
		return // unclaimed device — no account to scope to
	}

	for _, rule := range s.scheduler.rules {
		if rule.TriggerType != TriggerTypeSensor {
			continue
		}
		// Only evaluate rules belonging to the same account
		if rule.AccountID == nil || *rule.AccountID != *dev.AccountID {
			continue
		}
		if rule.TriggerSensorTypeID == nil {
			continue
		}
		sensorTypeID := s.getSensorTypeID(data.SensorType)
		if sensorTypeID != *rule.TriggerSensorTypeID {
			continue
		}
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
		return math.Abs(actualValue-thresholdValue) < 1e-9
	case AutomationConditionGTE:
		return actualValue >= thresholdValue
	case AutomationConditionLTE:
		return actualValue <= thresholdValue
	default:
		return false
	}
}

func (s *Service) isGlobalAutomationEnabled() bool {
	s.globalMu.RLock()
	defer s.globalMu.RUnlock()
	return s.globalAutomationEnabled
}

func (s *Service) executeAutomationRule(rule *AutomationRule, triggerData *sensor.SensorData) {
	// Check global kill-switch
	if !s.isGlobalAutomationEnabled() {
		log.Printf("Global automation disabled, skipping rule: %s", rule.Name)
		return
	}

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
		func(_ int, status string) {
			_ = s.automationRepo.UpdateLastCommandStatus(rule.ID, status)
		},
	)

	if err != nil {
		log.Printf("Failed to execute automation command for rule %d: %v", rule.ID, err)
		return
	}

	log.Printf("Automation command executed: %s on device %d (command ID: %d)",
		rule.ActionCommand, rule.TargetDeviceID, command.ID)

	_ = s.automationRepo.IncrementExecutionCount(rule.ID)
	_ = s.automationRepo.UpdateLastTriggered(rule.ID)

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
	if id, ok := s.sensorTypeCache[sensorType]; ok {
		return id
	}
	return 0
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
		nil,
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
	TotalRules              int                      `json:"total_rules"`
	ActiveRules             int                      `json:"active_rules"`
	PausedRules             int                      `json:"paused_rules"`
	FailedRules             int                      `json:"failed_rules"`
	RecentExecutions        []map[string]interface{} `json:"recent_executions"`
	FieldSummaries          []map[string]interface{} `json:"field_summaries"`
	GlobalAutomationEnabled bool                     `json:"global_automation_enabled"`
}

func (s *Service) GetDashboard(userID int, accountID int) (*AutomationDashboardData, error) {
	rules, err := s.automationRepo.GetByUserID(userID, accountID)
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
	if err := s.automationRepo.SetGlobalAutomationEnabled(enabled); err != nil {
		return err
	}
	s.globalMu.Lock()
	s.globalAutomationEnabled = enabled
	s.globalMu.Unlock()
	return nil
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

		scheduledTime, ok := s.getScheduledTimeIfDue(*rule.ScheduleCron, now, rule.Timezone)
		if !ok {
			continue
		}

		// Skip if we already fired for this scheduled time
		if lastFired, exists := s.lastFired[rule.ID]; exists && !lastFired.Before(scheduledTime) {
			continue
		}

		log.Printf("Executing scheduled automation rule: %s", rule.Name)
		s.lastFired[rule.ID] = scheduledTime
		if s.executeFunc != nil {
			s.executeFunc(rule)
		}
	}
}

func (s *Scheduler) getScheduledTimeIfDue(cronExpr string, now time.Time, timezone string) (time.Time, bool) {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		log.Printf("Failed to parse cron expression %q: %v", cronExpr, err)
		return time.Time{}, false
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

	// Get the most recent scheduled time before now
	prev := schedule.Next(nowInLoc.Add(-2 * time.Minute))
	scheduledTime := schedule.Next(prev)

	// If the scheduled time is in the future, not due yet
	if scheduledTime.After(nowInLoc) {
		return time.Time{}, false
	}

	// If more than 2 minutes have passed since the scheduled time, too late (skip)
	if nowInLoc.Sub(scheduledTime) > 2*time.Minute {
		return time.Time{}, false
	}

	return scheduledTime, true
}
