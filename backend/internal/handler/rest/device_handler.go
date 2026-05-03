package rest

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type DeviceHandler struct {
	deviceRepo domain.DeviceRepository
}

func NewDeviceHandler(deviceRepo domain.DeviceRepository) *DeviceHandler {
	return &DeviceHandler{
		deviceRepo: deviceRepo,
	}
}

func (h *DeviceHandler) Create(c *gin.Context) {
	var device domain.Device
	if err := c.ShouldBindJSON(&device); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	device.UserID = userID.(int)

	// Set default status - always offline until device connects
	device.Status = domain.DeviceStatusOffline

	if err := h.deviceRepo.Create(&device); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, device)
}

func (h *DeviceHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	device, err := h.deviceRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}

	c.JSON(http.StatusOK, device)
}

func (h *DeviceHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")

	// Parse pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	devices, total, err := h.deviceRepo.List(userID.(int), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"devices": devices,
		"total":   total,
		"page":    page,
		"limit":   limit,
	})
}

func (h *DeviceHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	var device domain.Device
	if err := c.ShouldBindJSON(&device); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	device.ID = id

	// Set default status - always offline until device connects
	device.Status = domain.DeviceStatusOffline

	if err := h.deviceRepo.Update(&device); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, device)
}

func (h *DeviceHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	if err := h.deviceRepo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
