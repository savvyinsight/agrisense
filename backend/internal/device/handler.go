package device

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type DeviceHandler struct {
	deviceRepo DeviceRepository
}

func NewDeviceHandler(deviceRepo DeviceRepository) *DeviceHandler {
	return &DeviceHandler{
		deviceRepo: deviceRepo,
	}
}

func (h *DeviceHandler) Create(c *gin.Context) {
	var device Device
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
	device.Status = DeviceStatusOffline

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

	existing, err := h.deviceRepo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if v, ok := updates["name"]; ok { existing.Name = v.(string) }
	if v, ok := updates["device_id"]; ok { existing.DeviceID = v.(string) }
	if v, ok := updates["type"]; ok { existing.Type = DeviceType(v.(string)) }
	if v, ok := updates["location"]; ok {
		s := v.(string)
		existing.Location = &s
	}
	if v, ok := updates["latitude"]; ok {
		f := v.(float64)
		existing.Latitude = &f
	}
	if v, ok := updates["longitude"]; ok {
		f := v.(float64)
		existing.Longitude = &f
	}
	if v, ok := updates["firmware_version"]; ok {
		s := v.(string)
		existing.FirmwareVersion = &s
	}
	if v, ok := updates["config"]; ok { existing.Config = v.(map[string]interface{}) }
	if v, ok := updates["field_id"]; ok {
		f := int(v.(float64))
		existing.FieldID = &f
	}

	if err := h.deviceRepo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, existing)
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

// ClaimDeviceHandler claims an unclaimed device for the current user
// POST /api/v1/devices/claim
func (h *DeviceHandler) ClaimDeviceHandler(c *gin.Context) {
	var req struct {
		DeviceID string `json:"device_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id required"})
		return
	}

	userID, _ := c.Get("user_id")
	accountID, exists := c.Get("account_id")
	if !exists {
		c.JSON(http.StatusForbidden, gin.H{"error": "No account found"})
		return
	}

	if err := h.deviceRepo.ClaimDevice(req.DeviceID, userID.(int), accountID.(int)); err != nil {
		if err.Error() == "device already claimed by another user" {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Device not found"})
		return
	}

	claimed, _ := h.deviceRepo.GetByDeviceID(req.DeviceID)
	c.JSON(http.StatusOK, claimed)
}

// UnclaimDeviceHandler resets a device to unclaimed state (admin only)
// POST /api/v1/devices/:id/unclaim
func (h *DeviceHandler) UnclaimDeviceHandler(c *gin.Context) {
	deviceID := c.Param("id")

	if err := h.deviceRepo.UnclaimDevice(deviceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unclaim device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "unclaimed"})
}
