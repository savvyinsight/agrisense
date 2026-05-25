package ruleengine

import (
	"log"
	"sync"
	"time"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

type Engine struct {
	rules          map[int]*alert.AlertRule
	rulesMutex     sync.RWMutex
	evaluator      *Evaluator
	alertSvc       alert.AlertRepository
	ruleRepo       alert.AlertRuleRepository
	deviceRepo     device.DeviceRepository
	fieldRepo      field.FieldRepository
	sensorTypeRepo sensor.SensorTypeRepository
	sensorTypeCache map[string]int
	stopChan       chan struct{}
}

func NewEngine(ruleRepo alert.AlertRuleRepository,
	alertSvc alert.AlertRepository,
	deviceRepo device.DeviceRepository,
	fieldRepo field.FieldRepository,
	sensorTypeRepo sensor.SensorTypeRepository) *Engine {
	e := &Engine{
		rules:          make(map[int]*alert.AlertRule),
		evaluator:      NewEvaluator(),
		ruleRepo:       ruleRepo,
		alertSvc:       alertSvc,
		deviceRepo:     deviceRepo,
		fieldRepo:      fieldRepo,
		sensorTypeRepo: sensorTypeRepo,
		sensorTypeCache: make(map[string]int),
		stopChan:       make(chan struct{}),
	}
	e.loadSensorTypeCache()
	return e
}

// SetFieldRepo allows setting fieldRepo after construction (for circular dependency resolution).
func (e *Engine) SetFieldRepo(fieldRepo field.FieldRepository) {
	e.fieldRepo = fieldRepo
}

func (e *Engine) Start() error {
	log.Println("Starting rule engine...")

	// Load rules initially
	if err := e.loadRules(); err != nil {
		return err
	}

	// Refresh sensor type cache
	e.loadSensorTypeCache()

	// Start background rule refresh (every 5 minutes)
	go e.refreshRulesPeriodically()

	return nil
}

func (e *Engine) Stop() {
	close(e.stopChan)
}

func (e *Engine) loadRules() error {
	rules, err := e.ruleRepo.GetEnabledRules(0)
	if err != nil {
		return err
	}

	e.rulesMutex.Lock()
	defer e.rulesMutex.Unlock()

	e.rules = make(map[int]*alert.AlertRule)
	for _, rule := range rules {
		e.rules[rule.ID] = &rule
	}

	log.Printf("Loaded %d enabled rules", len(e.rules))
	return nil
}

func (e *Engine) loadSensorTypeCache() {
	sensorTypes, err := e.sensorTypeRepo.GetSensorTypes()
	if err != nil {
		log.Printf("Warning: failed to load sensor types: %v", err)
		return
	}
	for _, st := range sensorTypes {
		e.sensorTypeCache[st.Name] = st.ID
	}
}

func (e *Engine) refreshRulesPeriodically() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := e.loadRules(); err != nil {
				log.Printf("Failed to refresh rules: %v", err)
			}
		case <-e.stopChan:
			return
		}
	}
}

func (e *Engine) Evaluate(data *sensor.SensorData) {
	e.rulesMutex.RLock()
	defer e.rulesMutex.RUnlock()

	// Get device to check its ID
	device, err := e.deviceRepo.GetByDeviceID(data.DeviceID)
	if err != nil {
		log.Printf("Device %s not found, skipping rule evaluation", data.DeviceID)
		return
	}

	for _, rule := range e.rules {
		// Check if rule applies to this device (device_id takes precedence over field_id)
		if rule.DeviceID != nil && *rule.DeviceID != 0 {
			if *rule.DeviceID != device.ID {
				continue
			}
		} else if rule.FieldID != nil && *rule.FieldID != 0 {
			if device.FieldID == nil || *device.FieldID != *rule.FieldID {
				continue
			}
		}

		// Check sensor type
		if rule.SensorTypeID != e.getSensorTypeID(data.SensorType) {
			continue
		}

		// Evaluate the rule
		if e.evaluator.Evaluate(rule, data) {
			e.triggerAlert(rule, data)
		}
	}
}

func (e *Engine) getSensorTypeID(sensorType string) int {
	if id, ok := e.sensorTypeCache[sensorType]; ok {
		return id
	}
	return 0
}

func (e *Engine) triggerAlert(rule *alert.AlertRule, data *sensor.SensorData) {
	// Get device from database using the string device_id
	dev, err := e.deviceRepo.GetByDeviceID(data.DeviceID)
	if err != nil {
		log.Printf("Failed to find device %s: %v", data.DeviceID, err)
		return
	}

	// Dedup: skip if an unresolved alert already exists for this rule + device
	existing, err := e.alertSvc.GetActiveByRuleAndDevice(rule.ID, dev.ID)
	if err != nil {
		log.Printf("Failed to check existing alerts: %v", err)
		return
	}
	if existing != nil {
		return
	}

	alertRecord := &alert.Alert{
		RuleID:      rule.ID,
		DeviceID:    dev.ID,
		DeviceIDStr: data.DeviceID,
		DeviceName:  dev.Name,
		RuleName:    rule.Name,
		FieldID:     dev.FieldID,
		SensorValue: data.Value,
		Message:     e.evaluator.FormatMessage(rule, data),
		Severity:    rule.Severity,
		Status:      alert.AlertStatusTriggered,
		TriggeredAt: time.Now(),
		Metadata: map[string]interface{}{
			"sensor_type": data.SensorType,
			"value":       data.Value,
			"rule_name":   rule.Name,
		},
	}

	if err := e.alertSvc.Create(alertRecord); err != nil {
		log.Printf("Failed to save alert: %v", err)
		return
	}

	log.Printf("🚨 Alert triggered: %s (rule: %s)", alertRecord.Message, rule.Name)

	// Update field health based on active alerts for this field
	if e.fieldRepo != nil && dev.FieldID != nil {
		if err := e.updateFieldHealth(*dev.FieldID); err != nil {
			log.Printf("Failed to update field %d health: %v", *dev.FieldID, err)
		}
	}

	// Broadcast via WebSocket to the device's user
	if dev.UserID != nil && *dev.UserID > 0 {
		wsMsg := map[string]interface{}{
			"type":    "alert_triggered",
			"payload": alertRecord,
		}
		wsHub := websocket.GetHub()
		wsHub.BroadcastToUser(*dev.UserID, wsMsg)
	}

	// TODO: Send email notification
}

func (e *Engine) updateFieldHealth(fieldID int) error {
	activeAlerts, err := e.alertSvc.GetActiveAlertsByField(fieldID, 0)
	if err != nil {
		return err
	}

	health := field.FieldHealthHealthy
	for _, a := range activeAlerts {
		// Only triggered alerts affect field health — acknowledged means handled
		if a.Status != alert.AlertStatusTriggered {
			continue
		}
		if a.Severity == alert.SeverityCritical {
			health = field.FieldHealthCritical
			break
		}
		if a.Severity == alert.SeverityWarning && health != field.FieldHealthCritical {
			health = field.FieldHealthWarning
		}
	}

	return e.fieldRepo.UpdateHealth(fieldID, health)
}
