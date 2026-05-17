package irrigation

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type createZoneRequest struct {
	Name           string  `json:"name" binding:"required,max=100"`
	FieldID        int     `json:"field_id" binding:"required"`
	DeviceID       *int    `json:"device_id"`
	TargetMoisture float64 `json:"target_moisture" binding:"required,min=10,max=100"`
	FlowRateLPM    float64 `json:"flow_rate_lpm" binding:"required,min=0"`
}

type updateZoneRequest struct {
	Name           *string  `json:"name" binding:"omitempty,max=100"`
	DeviceID       *int     `json:"device_id"`
	TargetMoisture *float64 `json:"target_moisture" binding:"omitempty,min=10,max=100"`
	FlowRateLPM    *float64 `json:"flow_rate_lpm" binding:"omitempty,min=0"`
}

type IrrigationHandler struct {
	repo     IrrigationZoneRepository
	eventRepo IrrigationEventRepository
	cmds     CommandSender
}

func NewIrrigationHandler(repo IrrigationZoneRepository, eventRepo IrrigationEventRepository, cmds CommandSender) *IrrigationHandler {
	return &IrrigationHandler{repo: repo, eventRepo: eventRepo, cmds: cmds}
}

func (h *IrrigationHandler) sendZoneCommand(zone *IrrigationZone, command string) error {
	if zone.DeviceID == nil {
		return nil
	}
	return h.cmds.SendCommand(*zone.DeviceID, command, map[string]interface{}{
		"zone_id":   zone.ID,
		"zone_name": zone.Name,
		"field_id":  zone.FieldID,
	}, zone.UserID)
}

func (h *IrrigationHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	fieldID, _ := strconv.Atoi(c.DefaultQuery("field_id", "0"))

	zones, err := h.repo.ListByFieldID(fieldID, userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if zones == nil {
		zones = []IrrigationZone{}
	}

	c.JSON(http.StatusOK, gin.H{"data": zones, "total": len(zones)})
}

func (h *IrrigationHandler) Create(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req createZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	zone := IrrigationZone{
		Name:           req.Name,
		FieldID:        req.FieldID,
		DeviceID:       req.DeviceID,
		Moisture:       0,
		TargetMoisture: req.TargetMoisture,
		Status:         ZoneStatusIdle,
		RuntimeMinutes: 0,
		FlowRateLPM:    req.FlowRateLPM,
		UserID:         userID.(int),
	}

	if err := h.repo.Create(&zone); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, zone)
}

func (h *IrrigationHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid zone id"})
		return
	}

	existing, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "zone not found"})
		return
	}

	if existing.Status == ZoneStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "cannot update zone while it is active"})
		return
	}

	var req updateZoneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		existing.Name = *req.Name
	}
	if req.DeviceID != nil {
		existing.DeviceID = req.DeviceID
	}
	if req.TargetMoisture != nil {
		existing.TargetMoisture = *req.TargetMoisture
	}
	if req.FlowRateLPM != nil {
		existing.FlowRateLPM = *req.FlowRateLPM
	}

	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, existing)
}

func (h *IrrigationHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid zone id"})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *IrrigationHandler) Start(c *gin.Context) {
	userID, _ := c.Get("user_id")

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid zone id"})
		return
	}

	zone, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "zone not found"})
		return
	}

	if zone.Status == ZoneStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "zone is already active"})
		return
	}

	if err := h.sendZoneCommand(zone, "irrigation_start"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send start command to device"})
		return
	}

	if err := h.repo.UpdateStatus(id, ZoneStatusActive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	uid := userID.(int)
	event := IrrigationEvent{
		ZoneID:      zone.ID,
		FieldID:     zone.FieldID,
		DeviceID:    zone.DeviceID,
		Status:      EventStatusRunning,
		StartTime:   time.Now(),
		TriggerType: TriggerManual,
		TriggeredBy: &uid,
	}
	if err := h.eventRepo.Create(&event); err != nil {
		log.Printf("Failed to log irrigation start event: %v", err)
	}

	zone.Status = ZoneStatusActive
	c.JSON(http.StatusOK, zone)
}

func (h *IrrigationHandler) Stop(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid zone id"})
		return
	}

	zone, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "zone not found"})
		return
	}

	if zone.Status != ZoneStatusActive {
		c.JSON(http.StatusConflict, gin.H{"error": "zone is not active"})
		return
	}

	if err := h.sendZoneCommand(zone, "irrigation_stop"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send stop command to device"})
		return
	}

	now := time.Now()

	// Complete the running event and get runtime
	if err := h.eventRepo.CompleteLatestRunning(zone.ID, now, 0, 0); err != nil {
		log.Printf("Failed to complete irrigation event: %v", err)
	}

	if err := h.repo.UpdateStatus(id, ZoneStatusIdle); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	zone.Status = ZoneStatusIdle
	c.JSON(http.StatusOK, zone)
}

func (h *IrrigationHandler) Retry(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid zone id"})
		return
	}

	zone, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "zone not found"})
		return
	}

	if zone.Status != ZoneStatusFailed {
		c.JSON(http.StatusConflict, gin.H{"error": "zone is not in failed state"})
		return
	}

	if err := h.sendZoneCommand(zone, "irrigation_retry"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send retry command to device"})
		return
	}

	if err := h.repo.UpdateStatus(id, ZoneStatusScheduled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	zone.Status = ZoneStatusScheduled
	c.JSON(http.StatusOK, zone)
}

func (h *IrrigationHandler) ListEvents(c *gin.Context) {
	zoneID, _ := strconv.Atoi(c.DefaultQuery("zone_id", "0"))
	fieldID, _ := strconv.Atoi(c.DefaultQuery("field_id", "0"))
	limit := 20

	var events []IrrigationEvent
	var err error

	if zoneID > 0 {
		events, err = h.eventRepo.ListByZoneID(zoneID, limit)
	} else if fieldID > 0 {
		events, err = h.eventRepo.ListByFieldID(fieldID, limit)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "zone_id or field_id is required"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": events, "total": len(events)})
}
