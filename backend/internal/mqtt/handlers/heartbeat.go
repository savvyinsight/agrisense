package handlers

import (
	"encoding/json"
	"log"
	"time"
)

type HeartbeatData struct {
	Timestamp time.Time `json:"timestamp"`
	RSSI      int       `json:"rssi,omitempty"`    // Signal strength
	Battery   int       `json:"battery,omitempty"` // Battery percentage
	Status    string    `json:"status,omitempty"`  // Any status message
}

func HandleHeartbeat(deviceID string, payload []byte) {
	log.Printf("Received heartbeat from device %s", deviceID)

	var data HeartbeatData
	if err := json.Unmarshal(payload, &data); err != nil {
		log.Printf("Failed to parse heartbeat from device %s: %v", deviceID, err)
		return
	}

	// Auto-register device if it doesn't exist yet, then atomically transition
	// offline→online. Only broadcasts if the status actually changed.
	if deviceRepo != nil {
		if _, err := deviceRepo.FindOrCreate(deviceID); err != nil {
			log.Printf("Failed to find/create device %s: %v", deviceID, err)
		} else {
			tryBroadcastOnline(deviceID)
		}
		if err := deviceRepo.UpdateHeartbeat(deviceID); err != nil {
			log.Printf("Failed to update heartbeat for device %s: %v", deviceID, err)
		}
		log.Printf("Device %s heartbeat processed", deviceID)
	} else {
		log.Printf("WARNING: Device repository not initialized, skipping status update for %s", deviceID)
	}

	log.Printf("Device %s heartbeat at %v", deviceID, data.Timestamp)
	if data.Battery > 0 {
		log.Printf("  Battery: %d%%", data.Battery)
	}
	if data.RSSI != 0 {
		log.Printf("  Signal: %d dBm", data.RSSI)
	}
}
