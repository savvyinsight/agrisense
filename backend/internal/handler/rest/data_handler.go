package rest

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisenseiot/internal/service/data"
)

type DataHandler struct {
	dataService *data.Service
}

func NewDataHandler(dataService *data.Service) *DataHandler {
	return &DataHandler{
		dataService: dataService,
	}
}

func (h *DataHandler) GetLatest(c *gin.Context) {
	deviceID := c.Param("id") // Change from :deviceId to :id
	sensorType := c.Query("sensor_type")
	if sensorType == "" {
		sensorType = "temperature" // Default
	}

	reading, err := h.dataService.GetLatestReading(deviceID, sensorType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, reading)
}

func (h *DataHandler) GetHistorical(c *gin.Context) {
	deviceID := c.Param("id") // Fix #1: Use "id", not "deviceId"
	sensorType := c.Query("sensor_type")

	log.Printf("GetHistorical called: device=%s, type=%s", deviceID, sensorType)

	if sensorType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sensor_type is required"})
		return
	}

	// Parse time range
	startStr := c.Query("start")
	endStr := c.Query("end")

	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start time format"})
			return
		}
	} else {
		start = time.Now().Add(-24 * time.Hour)
	}

	if endStr != "" {
		end, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end time format"})
			return
		}
	} else {
		end = time.Now()
	}

	data, err := h.dataService.GetHistoricalData(deviceID, sensorType, start, end)

	// Fix #2: Handle nil error
	if err != nil {
		log.Printf("Query error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("Query result: %d records", len(data))
	c.JSON(http.StatusOK, data)
}

func (h *DataHandler) GetLatestForMultipleDevices(c *gin.Context) {
	deviceIDsStr := c.Query("device_ids")
	if deviceIDsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_ids is required"})
		return
	}

	// Parse comma-separated device IDs
	deviceIDs := strings.Split(deviceIDsStr, ",")
	if len(deviceIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_ids cannot be empty"})
		return
	}

	// Trim whitespace from each ID
	for i, id := range deviceIDs {
		deviceIDs[i] = strings.TrimSpace(id)
	}

	sensorType := c.DefaultQuery("sensor_type", "temperature")

	readings, err := h.dataService.GetLatestReadingsForDevices(deviceIDs, sensorType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"devices": readings})
}

func (h *DataHandler) GetAggregated(c *gin.Context) {
	deviceID := c.Param("deviceId")
	sensorType := c.Query("sensor_type")
	interval := c.DefaultQuery("interval", "1h")

	if sensorType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sensor_type is required"})
		return
	}

	// Parse time range (default: last 7 days)
	startStr := c.Query("start")
	endStr := c.Query("end")

	var start, end time.Time
	var err error

	if startStr != "" {
		start, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start time format"})
			return
		}
	} else {
		start = time.Now().Add(-7 * 24 * time.Hour)
	}

	if endStr != "" {
		end, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end time format"})
			return
		}
	} else {
		end = time.Now()
	}

	data, err := h.dataService.GetAggregatedData(deviceID, sensorType, start, end, interval)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, data)
}
