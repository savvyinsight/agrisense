package escalation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/middleware"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type createEscalationRuleRequest struct {
	Name            string            `json:"name" binding:"required"`
	TriggerSeverity string            `json:"trigger_severity" binding:"required"`
	Levels          []EscalationLevel `json:"levels" binding:"required,min=1"`
	Enabled         *bool             `json:"enabled"`
}

type updateEscalationRuleRequest struct {
	Name            string            `json:"name"`
	TriggerSeverity string            `json:"trigger_severity"`
	Levels          []EscalationLevel `json:"levels"`
	Enabled         *bool             `json:"enabled"`
}

func (h *Handler) ListRules(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	rules, err := h.service.ListRules(accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *Handler) CreateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	var req createEscalationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule := &EscalationRule{
		Name:            req.Name,
		TriggerSeverity: req.TriggerSeverity,
		Levels:          req.Levels,
		AccountID:       &accountID,
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	} else {
		rule.Enabled = true
	}

	if err := h.service.CreateRule(rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) GetRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	rule, err := h.service.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if rule.AccountID != nil && *rule.AccountID != accountID {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *Handler) UpdateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	var req updateEscalationRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := h.service.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if existing.AccountID != nil && *existing.AccountID != accountID {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.TriggerSeverity != "" {
		existing.TriggerSeverity = req.TriggerSeverity
	}
	if req.Levels != nil {
		existing.Levels = req.Levels
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}

	if err := h.service.UpdateRule(id, existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, existing)
}

func (h *Handler) DeleteRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	existing, err := h.service.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if existing.AccountID != nil && *existing.AccountID != accountID {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	if err := h.service.DeleteRule(id, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) GetHistory(c *gin.Context) {
	alertID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	history, err := h.service.GetHistory(alertID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"history": history})
}
