package handlers

import (
	"encoding/json"
	"log"

	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

// StatusPayload is the expected payload on device/+/status topics.
// Devices should publish this as their MQTT Last Will and Testament (LWT)
// so the broker sends it when the device disconnects ungracefully.
type StatusPayload struct {
	Status string `json:"status"` // "online" or "offline"
}

// HandleStatus processes LWT and explicit status messages from devices.
// When a device disconnects ungracefully, the MQTT broker publishes the will
// message on device/{id}/status, which arrives here.
func HandleStatus(deviceID string, payload []byte) {
	log.Printf("Received status message from device %s: %s", deviceID, string(payload))

	if deviceRepo == nil {
		log.Printf("WARNING: Device repository not initialized, skipping status update for %s", deviceID)
		return
	}

	var data StatusPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		log.Printf("Failed to parse status from device %s: %v", deviceID, err)
		return
	}

	// Determine new status
	var newStatus device.DeviceStatus
	switch data.Status {
	case "offline":
		newStatus = device.DeviceStatusOffline
	case "online":
		newStatus = device.DeviceStatusOnline
	default:
		log.Printf("Unknown status '%s' from device %s, ignoring", data.Status, deviceID)
		return
	}

	// Atomic transition: only broadcast if the status actually changed
	changed, err := deviceRepo.UpdateStatusIfChanged(deviceID, newStatus)
	if err != nil {
		log.Printf("Failed to update device %s status to %s: %v", deviceID, newStatus, err)
		return
	}
	if !changed {
		return // already in the requested status
	}

	// Get device info for the broadcast
	dev, err := deviceRepo.GetByDeviceID(deviceID)
	if err != nil {
		log.Printf("Failed to get device %s for broadcast: %v", deviceID, err)
		return
	}

	log.Printf("Device %s status changed to %s (via LWT/status topic)", deviceID, newStatus)
	hub := websocket.GetHub()
	msg := map[string]interface{}{
		"type": "device_status_changed",
		"payload": map[string]interface{}{
			"device_id": dev.DeviceID,
			"name":      dev.Name,
			"status":    string(newStatus),
			"field_id":  dev.FieldID,
			"user_id":   dev.UserID,
		},
	}
	if dev.UserID != nil {
		hub.BroadcastToUser(*dev.UserID, msg)
	} else {
		hub.BroadcastAll(msg)
	}

	// Update Prometheus metric
	updateActiveDeviceCount()
}
