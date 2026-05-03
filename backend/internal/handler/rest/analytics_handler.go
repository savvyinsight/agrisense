package rest

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisenseiot/internal/service/analytics"
)

type AnalyticsHandler struct {
	analyticsService *analytics.Service
}

func NewAnalyticsHandler(analyticsService *analytics.Service) *AnalyticsHandler {
	return &AnalyticsHandler{analyticsService: analyticsService}
}

func (h *AnalyticsHandler) GetReport(c *gin.Context) {
	deviceIDStr := c.Query("device_id")
	if deviceIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		return
	}

	deviceID, err := strconv.Atoi(deviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id must be an integer"})
		return
	}

	startStr := c.Query("start")
	endStr := c.Query("end")
	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start and end are required"})
		return
	}

	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start must be RFC3339"})
		return
	}

	end, err := time.Parse(time.RFC3339, endStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end must be RFC3339"})
		return
	}

	reportType := c.DefaultQuery("report_type", "daily")

	report, err := h.analyticsService.GenerateReport(deviceID, start, end, reportType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
