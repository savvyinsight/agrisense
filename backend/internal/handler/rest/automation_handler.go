package rest

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/savvyinsight/agrisenseiot/internal/service/automation"
)

type AutomationHandler struct {
	automationService *automation.Service
}

func NewAutomationHandler(automationService *automation.Service) *AutomationHandler {
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
	var triggerType domain.AutomationTriggerType
	switch req.TriggerType {
	case "sensor":
		triggerType = domain.TriggerTypeSensor
	case "schedule":
		triggerType = domain.TriggerTypeSchedule
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid trigger type"})
		return
	}

	// Convert string condition to domain type
	var condition domain.AutomationCondition
	if req.TriggerCondition != "" {
		switch req.TriggerCondition {
		case ">":
			condition = domain.AutomationConditionGT
		case "<":
			condition = domain.AutomationConditionLT
		case "=":
			condition = domain.AutomationConditionEQ
		case ">=":
			condition = domain.AutomationConditionGTE
		case "<=":
			condition = domain.AutomationConditionLTE
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

	rule := &domain.AutomationRule{
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
	}

	if err := h.automationService.CreateRule(rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *AutomationHandler) ListRules(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}

	rules, err := h.automationService.GetRulesByUser(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *AutomationHandler) GetRule(c *gin.Context) {
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

	// Check if user owns this rule
	userID, exists := c.Get("user_id")
	if !exists || rule.UserID != userID.(int) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AutomationHandler) UpdateRule(c *gin.Context) {
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

	// Check if user owns this rule
	userID, exists := c.Get("user_id")
	if !exists || rule.UserID != userID.(int) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	// Update fields
	rule.Name = req.Name
	rule.TargetDeviceID = req.TargetDeviceID

	// Convert trigger type
	switch req.TriggerType {
	case "sensor":
		rule.TriggerType = domain.TriggerTypeSensor
	case "schedule":
		rule.TriggerType = domain.TriggerTypeSchedule
	}

	rule.TriggerSensorTypeID = req.TriggerSensorTypeID

	// Convert condition
	if req.TriggerCondition != "" {
		switch req.TriggerCondition {
		case ">":
			rule.TriggerCondition = domain.AutomationConditionGT
		case "<":
			rule.TriggerCondition = domain.AutomationConditionLT
		case "=":
			rule.TriggerCondition = domain.AutomationConditionEQ
		case ">=":
			rule.TriggerCondition = domain.AutomationConditionGTE
		case "<=":
			rule.TriggerCondition = domain.AutomationConditionLTE
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

	// Check if user owns this rule
	userID, exists := c.Get("user_id")
	if !exists || rule.UserID != userID.(int) {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	if err := h.automationService.DeleteRule(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
