package rest

import (
    "net/http"
    "strconv"

    "github.com/gin-gonic/gin"
    "github.com/savvyinsight/agrisenseiot/internal/service/control"
)

type ControlHandler struct {
    controlService *control.Service
}

func NewControlHandler(controlService *control.Service) *ControlHandler {
    return &ControlHandler{
        controlService: controlService,
    }
}

func (h *ControlHandler) SendCommand(c *gin.Context) {
    deviceID, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
        return
    }

    var req control.CommandRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get user ID from context (nil for auto/rules)
    userID, exists := c.Get("user_id")
    var uid *int
    if exists {
        id := userID.(int)
        uid = &id
    }

    cmd, err := h.controlService.SendCommand(deviceID, req, uid)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusAccepted, cmd)
}

func (h *ControlHandler) GetCommandStatus(c *gin.Context) {
    cmdID, err := strconv.Atoi(c.Param("cmdId"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid command id"})
        return
    }

    cmd, err := h.controlService.GetCommandStatus(cmdID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, cmd)
}

func (h *ControlHandler) ListDeviceCommands(c *gin.Context) {
    deviceID, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
        return
    }

    limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

    commands, err := h.controlService.GetDeviceCommands(deviceID, limit)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"commands": commands})
}
