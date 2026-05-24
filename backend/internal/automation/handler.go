package automation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/middleware"
)

type AutomationHandler struct {
	automationService *Service
}

func NewAutomationHandler(automationService *Service) *AutomationHandler {
	return &AutomationHandler{
		automationService: automationService,
	}
}

type CreateAutomationRuleRequest struct {
	Name                   string                 `json:"name" binding:"required"`
	TargetDeviceID         int                    `json:"target_device_id" binding:"required"`
	TriggerType            string                 `json:"trigger_type" binding:"required,oneof=sensor schedule"`
	TriggerSensorTypeID    *int                   `json:"trigger_sensor_type_id,omitempty"`
	TriggerCondition       string                 `json:"trigger_condition,omitempty"`
	TriggerValue           *float64               `json:"trigger_value,omitempty"`
	TriggerDurationSeconds int                    `json:"trigger_duration_seconds,omitempty"`
	ScheduleCron           *string                `json:"schedule_cron,omitempty"`
	Timezone               string                 `json:"timezone,omitempty"`
	ActionCommand          string                 `json:"action_command" binding:"required"`
	ActionParameters       map[string]interface{} `json:"action_parameters,omitempty"`
	Enabled                *bool                  `json:"enabled,omitempty"`
}

func (h *AutomationHandler) CreateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	var req CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	// Convert string trigger type to domain type
	var triggerType AutomationTriggerType
	switch req.TriggerType {
	case "sensor":
		triggerType = TriggerTypeSensor
	case "schedule":
		triggerType = TriggerTypeSchedule
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trigger type"})
		return
	}

	// Convert string condition to domain type
	var condition AutomationCondition
	if req.TriggerCondition != "" {
		switch req.TriggerCondition {
		case ">":
			condition = AutomationConditionGT
		case "<":
			condition = AutomationConditionLT
		case "=":
			condition = AutomationConditionEQ
		case ">=":
			condition = AutomationConditionGTE
		case "<=":
			condition = AutomationConditionLTE
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trigger condition"})
			return
		}
	}

	// Set defaults
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	timezone := "UTC"
	if req.Timezone != "" {
		timezone = req.Timezone
	}

	rule := &AutomationRule{
		Name:                   req.Name,
		TargetDeviceID:         req.TargetDeviceID,
		TriggerType:            triggerType,
		TriggerSensorTypeID:    req.TriggerSensorTypeID,
		TriggerCondition:       condition,
		TriggerValue:           req.TriggerValue,
		TriggerDurationSeconds: req.TriggerDurationSeconds,
		ScheduleCron:           req.ScheduleCron,
		Timezone:               timezone,
		ActionCommand:          req.ActionCommand,
		ActionParameters:       req.ActionParameters,
		Enabled:                enabled,
		UserID:                 userID.(int),
		AccountID:              &accountID,
	}

	if err := h.automationService.CreateRule(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *AutomationHandler) ListRules(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	rules, err := h.automationService.GetRulesByUser(userID.(int), accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *AutomationHandler) GetRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	rule, err := h.automationService.GetRuleByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	// Verify account ownership
	if rule.AccountID != nil && *rule.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AutomationHandler) UpdateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	var req CreateAutomationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get existing rule
	rule, err := h.automationService.GetRuleByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	// Verify account ownership
	if rule.AccountID != nil && *rule.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Update fields
	rule.Name = req.Name
	rule.TargetDeviceID = req.TargetDeviceID

	// Convert trigger type
	switch req.TriggerType {
	case "sensor":
		rule.TriggerType = TriggerTypeSensor
	case "schedule":
		rule.TriggerType = TriggerTypeSchedule
	}

	rule.TriggerSensorTypeID = req.TriggerSensorTypeID

	// Convert condition
	if req.TriggerCondition != "" {
		switch req.TriggerCondition {
		case ">":
			rule.TriggerCondition = AutomationConditionGT
		case "<":
			rule.TriggerCondition = AutomationConditionLT
		case "=":
			rule.TriggerCondition = AutomationConditionEQ
		case ">=":
			rule.TriggerCondition = AutomationConditionGTE
		case "<=":
			rule.TriggerCondition = AutomationConditionLTE
		}
	}

	rule.TriggerValue = req.TriggerValue
	rule.TriggerDurationSeconds = req.TriggerDurationSeconds
	rule.ScheduleCron = req.ScheduleCron
	if req.Timezone != "" {
		rule.Timezone = req.Timezone
	}
	rule.ActionCommand = req.ActionCommand
	rule.ActionParameters = req.ActionParameters
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}

	if err := h.automationService.UpdateRule(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AutomationHandler) DeleteRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	// Get existing rule to check ownership
	rule, err := h.automationService.GetRuleByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	// Verify account ownership
	if rule.AccountID != nil && *rule.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.automationService.DeleteRule(id, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *AutomationHandler) PauseRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	if err := h.automationService.PauseRule(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "paused": true})
}

func (h *AutomationHandler) ResumeRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	if err := h.automationService.ResumeRule(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "paused": false})
}

func (h *AutomationHandler) ExecuteNow(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	cmd, err := h.automationService.ExecuteNow(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "command": cmd})
}

func (h *AutomationHandler) GetDashboard(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	data, err := h.automationService.GetDashboard(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}

func (h *AutomationHandler) SetGlobalAutomation(c *gin.Context) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.automationService.SetGlobalAutomation(req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "enabled": req.Enabled})
}

func (h *AutomationHandler) GetCommandHistory(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule ID"})
		return
	}

	limit := 20
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	commands, err := h.automationService.GetCommandHistory(id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"commands": commands})
}
