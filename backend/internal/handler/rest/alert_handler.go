package rest

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/savvyinsight/agrisenseiot/internal/service/alert"
)

type AlertHandler struct {
	alertService *alert.Service
}

func NewAlertHandler(alertService *alert.Service) *AlertHandler {
	return &AlertHandler{
		alertService: alertService,
	}
}

// Rule endpoints

func (h *AlertHandler) CreateRule(c *gin.Context) {
	var rule domain.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	rule.UserID = userID.(int)

	if err := h.alertService.CreateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rule)
}

func (h *AlertHandler) GetRule(c *gin.Context) {
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

	c.JSON(http.StatusOK, rule)
}

func (h *AlertHandler) ListRules(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rules, err := h.alertService.ListRules(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"rules": rules})
}

func (h *AlertHandler) UpdateRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	var rule domain.AlertRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule.ID = id

	if err := h.alertService.UpdateRule(&rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rule)
}

func (h *AlertHandler) DeleteRule(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rule id"})
		return
	}

	if err := h.alertService.DeleteRule(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// Alert endpoints

func (h *AlertHandler) GetActiveAlerts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	alerts, total, err := h.alertService.GetActiveAlertsPaginated(page, limit)
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
	deviceID, err := strconv.Atoi(c.Param("deviceId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	alerts, err := h.alertService.GetAlertsByDevice(deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"alerts": alerts})
}

func (h *AlertHandler) AcknowledgeAlert(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	if err := h.alertService.AcknowledgeAlert(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "acknowledged"})
}

func (h *AlertHandler) ResolveAlert(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid alert id"})
		return
	}

	if err := h.alertService.ResolveAlert(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "resolved"})
}

func (h *AlertHandler) GetAlertHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	alerts, total, err := h.alertService.GetAlertHistory(page, limit)
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
