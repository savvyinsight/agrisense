package ruleengine

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/field"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

type Engine struct {
	rules           map[int]*alert.AlertRule
	rulesMutex      sync.RWMutex
	evaluator       *Evaluator
	alertSvc        alert.AlertRepository
	ruleRepo        alert.AlertRuleRepository
	deviceRepo      device.DeviceRepository
	fieldRepo       field.FieldRepository
	sensorTypeRepo  sensor.SensorTypeRepository
	sensorTypeCache map[string]int
	stopChan        chan struct{}

	// G1: Duration-based alert state
	breachStartTimes map[string]time.Time // key: "ruleID:deviceID", value: first breach time
	breachMutex      sync.RWMutex

	// G4: Flapping detection state
	resolveTimestamps map[string][]time.Time // key: "ruleID:deviceID", value: resolve times
	resolveMutex      sync.RWMutex
}

func NewEngine(ruleRepo alert.AlertRuleRepository,
	alertSvc alert.AlertRepository,
	deviceRepo device.DeviceRepository,
	fieldRepo field.FieldRepository,
	sensorTypeRepo sensor.SensorTypeRepository) *Engine {
	e := &Engine{
		rules:             make(map[int]*alert.AlertRule),
		evaluator:         NewEvaluator(),
		ruleRepo:          ruleRepo,
		alertSvc:          alertSvc,
		deviceRepo:        deviceRepo,
		fieldRepo:         fieldRepo,
		sensorTypeRepo:    sensorTypeRepo,
		sensorTypeCache:   make(map[string]int),
		stopChan:          make(chan struct{}),
		breachStartTimes:  make(map[string]time.Time),
		resolveTimestamps: make(map[string][]time.Time),
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

	// G1/G4: Periodic cleanup of stale breach and resolve state
	go e.cleanupState()

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

func (e *Engine) breachKey(ruleID, deviceID int) string {
	return fmt.Sprintf("%d:%d", ruleID, deviceID)
}

func (e *Engine) cleanupState() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			cutoff := time.Now().Add(-time.Hour)

			e.breachMutex.Lock()
			for k, t := range e.breachStartTimes {
				if t.Before(cutoff) {
					delete(e.breachStartTimes, k)
				}
			}
			e.breachMutex.Unlock()

			e.resolveMutex.Lock()
			for k, timestamps := range e.resolveTimestamps {
				filtered := make([]time.Time, 0, len(timestamps))
				for _, t := range timestamps {
					if t.After(cutoff) {
						filtered = append(filtered, t)
					}
				}
				if len(filtered) == 0 {
					delete(e.resolveTimestamps, k)
				} else {
					e.resolveTimestamps[k] = filtered
				}
			}
			e.resolveMutex.Unlock()

		case <-e.stopChan:
			return
		}
	}
}

func (e *Engine) Evaluate(data *sensor.SensorData) {
	e.rulesMutex.RLock()
	defer e.rulesMutex.RUnlock()

	dev, err := e.deviceRepo.GetByDeviceID(data.DeviceID)
	if err != nil {
		log.Printf("Device %s not found, skipping rule evaluation", data.DeviceID)
		return
	}

	for _, rule := range e.rules {
		if rule.DeviceID != nil && *rule.DeviceID != 0 {
			if *rule.DeviceID != dev.ID {
				continue
			}
		} else if rule.FieldID != nil && *rule.FieldID != 0 {
			if dev.FieldID == nil || *dev.FieldID != *rule.FieldID {
				continue
			}
		}

		if rule.SensorTypeID != e.getSensorTypeID(data.SensorType) {
			continue
		}

		// G2: Check recovery before trigger to prevent bounce
		e.checkRecovery(rule, data, dev)

		// G1: Threshold check with duration support
		if e.evaluator.Evaluate(rule, data) {
			if rule.DurationSeconds > 0 {
				key := e.breachKey(rule.ID, dev.ID)
				e.breachMutex.RLock()
				firstBreach, exists := e.breachStartTimes[key]
				e.breachMutex.RUnlock()

				if !exists {
					e.breachMutex.Lock()
					e.breachStartTimes[key] = time.Now()
					e.breachMutex.Unlock()
				} else if time.Since(firstBreach) >= time.Duration(rule.DurationSeconds)*time.Second {
					e.triggerAlert(rule, data, dev)
				}
			} else {
				e.triggerAlert(rule, data, dev)
			}
		} else {
			// Threshold not breached: clear duration state
			key := e.breachKey(rule.ID, dev.ID)
			e.breachMutex.Lock()
			delete(e.breachStartTimes, key)
			e.breachMutex.Unlock()
		}
	}
}

func (e *Engine) getSensorTypeID(sensorType string) int {
	if id, ok := e.sensorTypeCache[sensorType]; ok {
		return id
	}
	return 0
}

func (e *Engine) triggerAlert(rule *alert.AlertRule, data *sensor.SensorData, dev *device.Device) {
	// Dedup: skip if an unresolved alert already exists for this rule + device
	existing, err := e.alertSvc.GetActiveByRuleAndDevice(rule.ID, dev.ID)
	if err != nil {
		log.Printf("Failed to check existing alerts: %v", err)
		return
	}
	if existing != nil {
		return
	}

	// G5: Snooze suppression
	snoozed, err := e.alertSvc.GetRecentSnoozedByRuleAndDevice(rule.ID, dev.ID)
	if err != nil {
		log.Printf("Failed to check snoozed alerts: %v", err)
	}
	if snoozed != nil {
		log.Printf("Suppressing alert for rule %d device %d: snoozed until %v",
			rule.ID, dev.ID, snoozed.SnoozedUntil)
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

	log.Printf("Alert triggered: %s (rule: %s)", alertRecord.Message, rule.Name)

	if e.fieldRepo != nil && dev.FieldID != nil {
		if err := e.updateFieldHealth(*dev.FieldID); err != nil {
			log.Printf("Failed to update field %d health: %v", *dev.FieldID, err)
		}
	}

	if dev.UserID != nil && *dev.UserID > 0 {
		wsMsg := map[string]interface{}{
			"type":    "alert_triggered",
			"payload": alertRecord,
		}
		wsHub := websocket.GetHub()
		wsHub.BroadcastToUser(*dev.UserID, wsMsg)
	}

	// G8: Correlate with recent alerts on the same device
	go e.correlateAlert(alertRecord)
}

// G2: checkRecovery auto-resolves an alert when the sensor value meets the recovery condition.
func (e *Engine) checkRecovery(rule *alert.AlertRule, data *sensor.SensorData, dev *device.Device) {
	if rule.RecoveryThresholdValue == nil || rule.RecoveryCondition == nil {
		return
	}

	activeAlert, err := e.alertSvc.GetActiveByRuleAndDevice(rule.ID, dev.ID)
	if err != nil || activeAlert == nil {
		return
	}

	recoveryCondition := alert.AlertCondition(*rule.RecoveryCondition)
	recovered := e.evaluator.CheckRecovery(recoveryCondition, *rule.RecoveryThresholdValue, data.Value)

	if recovered {
		if err := e.alertSvc.Resolve(activeAlert.ID, 0); err != nil {
			log.Printf("Failed to auto-resolve alert %d: %v", activeAlert.ID, err)
			return
		}
		log.Printf("Auto-resolved alert %d: value %.2f met recovery condition %s %.2f",
			activeAlert.ID, data.Value, *rule.RecoveryCondition, *rule.RecoveryThresholdValue)

		key := e.breachKey(rule.ID, dev.ID)
		e.breachMutex.Lock()
		delete(e.breachStartTimes, key)
		e.breachMutex.Unlock()

		if e.fieldRepo != nil && dev.FieldID != nil {
			if err := e.updateFieldHealth(*dev.FieldID); err != nil {
				log.Printf("Failed to update field health after recovery: %v", err)
			}
		}

		// G4: Track flapping
		e.trackFlapping(activeAlert.ID, rule.ID, dev.ID)

		if dev.UserID != nil && *dev.UserID > 0 {
			wsMsg := map[string]interface{}{
				"type": "alert_resolved",
				"payload": map[string]interface{}{
					"alert_id": activeAlert.ID,
					"rule_id":  rule.ID,
					"message":  fmt.Sprintf("Alert auto-resolved: %s recovered to %.2f", data.SensorType, data.Value),
				},
			}
			wsHub := websocket.GetHub()
			wsHub.BroadcastToUser(*dev.UserID, wsMsg)
		}
	}
}

// G4: trackFlapping detects when an alert triggers and resolves repeatedly.
const (
	flapThreshold     = 3
	flapWindowMinutes = 60
)

func (e *Engine) trackFlapping(alertID, ruleID, deviceID int) {
	key := e.breachKey(ruleID, deviceID)
	now := time.Now()
	cutoff := now.Add(-time.Duration(flapWindowMinutes) * time.Minute)

	e.resolveMutex.Lock()
	defer e.resolveMutex.Unlock()

	timestamps := e.resolveTimestamps[key]
	timestamps = append(timestamps, now)

	filtered := make([]time.Time, 0, len(timestamps))
	for _, t := range timestamps {
		if t.After(cutoff) {
			filtered = append(filtered, t)
		}
	}
	e.resolveTimestamps[key] = filtered

	if len(filtered) >= flapThreshold {
		if err := e.alertSvc.UpdateFlapping(alertID, true, len(filtered)); err != nil {
			log.Printf("Failed to update flapping status for alert %d: %v", alertID, err)
		}
		log.Printf("Alert %d flagged as flapping (rule %d, device %d): %d resolves in %d minutes",
			alertID, ruleID, deviceID, len(filtered), flapWindowMinutes)
	}
}

// G8: correlateAlert groups related alerts on the same device within a time window.
func (e *Engine) correlateAlert(newAlert *alert.Alert) {
	const correlationWindow = 10 * time.Minute

	since := time.Now().Add(-correlationWindow)
	recentAlerts, err := e.alertSvc.GetRecentByDeviceID(newAlert.DeviceID, since)
	if err != nil {
		log.Printf("Failed to get recent alerts for correlation: %v", err)
		return
	}

	var existingCorrelationID *string
	var earliestAlert *alert.Alert

	for i, a := range recentAlerts {
		if a.ID == newAlert.ID {
			continue
		}
		if a.CorrelationID != nil {
			existingCorrelationID = a.CorrelationID
		}
		if earliestAlert == nil || a.TriggeredAt.Before(earliestAlert.TriggeredAt) {
			earliestAlert = &recentAlerts[i]
		}
	}

	var correlationID string
	if existingCorrelationID != nil {
		correlationID = *existingCorrelationID
	} else if len(recentAlerts) > 1 {
		correlationID = uuid.New().String()
	} else {
		return
	}

	var rootCause *string
	if earliestAlert != nil {
		msg := earliestAlert.Message
		rootCause = &msg
	}

	if err := e.alertSvc.UpdateCorrelation(newAlert.ID, correlationID, rootCause); err != nil {
		log.Printf("Failed to set correlation on alert %d: %v", newAlert.ID, err)
	}

	for _, a := range recentAlerts {
		if a.ID == newAlert.ID {
			continue
		}
		if a.CorrelationID == nil || *a.CorrelationID != correlationID {
			if err := e.alertSvc.UpdateCorrelation(a.ID, correlationID, rootCause); err != nil {
				log.Printf("Failed to update correlation on alert %d: %v", a.ID, err)
			}
		}
	}
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
