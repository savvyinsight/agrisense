package handlers

import (
	"log"
	"sync"
	"time"

	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/middleware"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

var (
	dataService *data.Service
	deviceRepo  device.DeviceRepository

	// dedupMap prevents duplicate "online" broadcasts when telemetry and heartbeat
	// arrive in quick succession. Maps deviceID → expiry time.
	// A single background goroutine cleans up expired entries.
	dedupMap   sync.Map
	dedupOnce  sync.Once
	dedupTTL   = 30 * time.Second
)

// Init sets the data service and device repository for handlers
func Init(ds *data.Service, dr device.DeviceRepository) {
	dataService = ds
	deviceRepo = dr
	// Start a single cleanup goroutine for the dedup map (once per process).
	dedupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(10 * time.Second)
			defer ticker.Stop()
			for range ticker.C {
				now := time.Now()
				dedupMap.Range(func(key, value any) bool {
					if now.After(value.(time.Time)) {
						dedupMap.Delete(key)
					}
					return true
				})
			}
		}()
	})
}

func HandleTelemetry(deviceID string, payload []byte) {
	if dataService == nil {
		log.Println("ERROR: Data service not initialized")
		return
	}

	// Record message for metrics
	middleware.RecordMessage()

	// Atomically transition device offline→online. Only broadcast if the
	// status actually changed (prevents duplicate toasts from concurrent handlers).
	if deviceRepo != nil {
		if _, err := deviceRepo.FindOrCreate(deviceID); err != nil {
			log.Printf("Failed to find/create device %s: %v", deviceID, err)
		} else {
			tryBroadcastOnline(deviceID)
		}
		if err := deviceRepo.UpdateHeartbeat(deviceID); err != nil {
			log.Printf("Failed to update heartbeat for device %s: %v", deviceID, err)
		}
	}

	if err := dataService.ProcessTelemetry(deviceID, payload); err != nil {
		log.Printf("Failed to process telemetry from device %s: %v", deviceID, err)
	}
}

// tryBroadcastOnline atomically marks the device online and broadcasts a
// device_status_changed message if the status actually transitioned.
// Uses dedupMap to prevent duplicate broadcasts within dedupTTL.
func tryBroadcastOnline(deviceID string) {
	// Dedup: skip if we recently broadcast "online" for this device
	if expiry, loaded := dedupMap.Load(deviceID); loaded && time.Now().Before(expiry.(time.Time)) {
		return
	}

	// Atomic transition: UPDATE ... WHERE status != 'online'
	changed, err := deviceRepo.UpdateStatusIfChanged(deviceID, device.DeviceStatusOnline)
	if err != nil {
		log.Printf("Failed to update device status for %s: %v", deviceID, err)
		return
	}
	if !changed {
		return // already online, no broadcast needed
	}

	// Set dedup entry (broadcast just happened)
	dedupMap.Store(deviceID, time.Now().Add(dedupTTL))

	// Get device info for the broadcast payload
	dev, err := deviceRepo.GetByDeviceID(deviceID)
	if err != nil {
		log.Printf("Failed to get device %s for broadcast: %v", deviceID, err)
		return
	}

	log.Printf("Device %s came back online (was offline)", deviceID)
	hub := websocket.GetHub()
	msg := map[string]interface{}{
		"type": "device_status_changed",
		"payload": map[string]interface{}{
			"device_id": dev.DeviceID,
			"name":      dev.Name,
			"status":    "online",
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

// updateActiveDeviceCount queries the current online device count and updates the Prometheus gauge.
func updateActiveDeviceCount() {
	if deviceRepo == nil {
		return
	}
	count, err := deviceRepo.CountByStatus(device.DeviceStatusOnline)
	if err != nil {
		log.Printf("Failed to count online devices for metrics: %v", err)
		return
	}
	middleware.SetActiveDevices(count)
}
