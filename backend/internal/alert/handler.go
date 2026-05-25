package alert

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/middleware"
)

type AlertHandler struct {
	alertService *Service
}

func NewAlertHandler(alertService *Service) *AlertHandler {
	return &AlertHandler{
		alertService: alertService,
	}
}

// Rule endpoints

func (h *AlertHandler) CreateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	var rule AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	rule.UserID = userID.(int)
	rule.AccountID = &accountID

	if err := h.alertService.CreateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *AlertHandler) GetRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	rule, err := h.alertService.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Verify account ownership
	if rule.AccountID != nil && *rule.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AlertHandler) ListRules(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	userID, _ := c.Get("user_id")

	rules, err := h.alertService.ListRules(accountID, userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *AlertHandler) UpdateRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	// Fetch existing rule to verify ownership
	existing, err := h.alertService.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if existing.AccountID != nil && *existing.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var rule AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = id
	rule.AccountID = &accountID

	if err := h.alertService.UpdateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AlertHandler) DeleteRule(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	// Fetch existing rule to verify ownership
	existing, err := h.alertService.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	if existing.AccountID != nil && *existing.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.alertService.DeleteRule(id, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Alert endpoints

func (h *AlertHandler) GetActiveAlerts(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	alerts, total, err := h.alertService.GetActiveAlertsPaginated(accountID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

func (h *AlertHandler) GetAlertsByDevice(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	deviceID, err := strconv.Atoi(c.Param("deviceId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	alerts, err := h.alertService.GetAlertsByDevice(deviceID, accountID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (h *AlertHandler) AcknowledgeAlert(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	// Verify account ownership
	alert, err := h.alertService.GetAlertByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
		return
	}
	if alert.AccountID != nil && *alert.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.alertService.AcknowledgeAlert(id, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "acknowledged"})
}

func (h *AlertHandler) ResolveAlert(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	// Verify account ownership
	alert, err := h.alertService.GetAlertByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
		return
	}
	if alert.AccountID != nil && *alert.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.alertService.ResolveAlert(id, accountID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "resolved"})
}

func (h *AlertHandler) GetAlertHistory(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	alerts, total, err := h.alertService.GetAlertHistory(accountID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": alerts,
		"total":  total,
		"page":   page,
		"limit":  limit,
	})
}

func (h *AlertHandler) SnoozeAlert(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	// Verify account ownership
	alert, err := h.alertService.GetAlertByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
		return
	}
	if alert.AccountID != nil && *alert.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		Minutes int    `json:"minutes" binding:"required"`
		Reason  string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.alertService.SnoozeAlert(id, req.Minutes, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "snoozed"})
}

func (h *AlertHandler) UnsnoozeAlert(c *gin.Context) {
	accountID, ok := middleware.MustGetAccountID(c)
	if !ok {
		return
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	// Verify account ownership
	alert, err := h.alertService.GetAlertByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "alert not found"})
		return
	}
	if alert.AccountID != nil && *alert.AccountID != accountID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.alertService.UnsnoozeAlert(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unsnoozed"})
}

func (h *AlertHandler) GetAlertCorrelations(c *gin.Context) {
	correlations, err := h.alertService.GetAlertCorrelations()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"correlations": correlations})
}
