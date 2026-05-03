package handlers

import (
	"encoding/json"
	"log"
	"time"
)

type CommandResponse struct {
	CommandID int       `json:"command_id"`
	Status    string    `json:"status"` // executed, failed
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message,omitempty"`
}

// This just logs and passes to callback - no control import!
func HandleResponse(deviceID string, payload []byte, callback func(string, []byte)) {
	log.Printf("Received command response from device %s", deviceID)

	var resp CommandResponse
	if err := json.Unmarshal(payload, &resp); err != nil {
		log.Printf("Failed to parse: %v", err)
		return
	}

	log.Printf("Device %s command %d: %s", deviceID, resp.CommandID, resp.Status)

	// Call back to service layer (no direct import)
	if callback != nil {
		callback(deviceID, payload)
	}
}
