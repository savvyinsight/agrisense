package irrigation

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type IrrigationHandler struct {
	repo IrrigationZoneRepository
}

func NewIrrigationHandler(repo IrrigationZoneRepository) *IrrigationHandler {
	return &IrrigationHandler{repo: repo}
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

func (h *IrrigationHandler) Start(c *gin.Context) {
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

	if err := h.repo.UpdateStatus(id, ZoneStatusActive); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
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

	if err := h.repo.UpdateStatus(id, ZoneStatusScheduled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	zone.Status = ZoneStatusScheduled
	c.JSON(http.StatusOK, zone)
}
