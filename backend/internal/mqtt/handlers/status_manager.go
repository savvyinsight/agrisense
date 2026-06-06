package handlers

import (
	"log"
	"sync"
	"time"

	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/middleware"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

// StatusManager handles periodic device status checks and updates.
// It detects devices that have stopped sending heartbeats and marks them offline,
// then broadcasts the status change via WebSocket so the frontend updates in real-time.
type StatusManager struct {
	deviceRepo       device.DeviceRepository
	heartbeatTimeout time.Duration
	checkInterval    time.Duration
	stop             chan struct{}
	stopOnce         sync.Once
}

// NewStatusManager creates a new device status manager.
// heartbeatTimeout: duration after which a device is considered offline (default: 2 minutes).
// checkInterval: interval at which to check for offline devices (default: 30 seconds).
func NewStatusManager(deviceRepo device.DeviceRepository, heartbeatTimeout, checkInterval time.Duration) *StatusManager {
	if heartbeatTimeout == 0 {
		heartbeatTimeout = 2 * time.Minute
	}
	if checkInterval == 0 {
		checkInterval = 30 * time.Second
	}

	return &StatusManager{
		deviceRepo:       deviceRepo,
		heartbeatTimeout: heartbeatTimeout,
		checkInterval:    checkInterval,
		stop:             make(chan struct{}),
	}
}

// Start begins the periodic status check loop.
func (sm *StatusManager) Start() {
	go sm.checkLoop()
	log.Printf("Device status manager started (heartbeat timeout: %v, check interval: %v)",
		sm.heartbeatTimeout, sm.checkInterval)
}

// Stop stops the status check loop. Safe to call multiple times.
func (sm *StatusManager) Stop() {
	sm.stopOnce.Do(func() {
		close(sm.stop)
		log.Println("Device status manager stopped")
	})
}

// checkLoop periodically checks for offline devices.
func (sm *StatusManager) checkLoop() {
	ticker := time.NewTicker(sm.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-sm.stop:
			return
		case <-ticker.C:
			sm.checkOfflineDevices()
		}
	}
}

// checkOfflineDevices marks devices as offline if they haven't sent heartbeats recently,
// then broadcasts the status change via WebSocket for each affected device.
func (sm *StatusManager) checkOfflineDevices() {
	offlineDevices, err := sm.deviceRepo.GetAndMarkOfflineByHeartbeat(sm.heartbeatTimeout)
	if err != nil {
		log.Printf("Error checking offline devices: %v", err)
		return
	}

	if len(offlineDevices) > 0 {
		log.Printf("Marked %d device(s) as offline (no heartbeat since %v)", len(offlineDevices), sm.heartbeatTimeout)

		// Broadcast status change for each device via WebSocket
		hub := websocket.GetHub()
		for _, d := range offlineDevices {
			msg := map[string]interface{}{
				"type": "device_status_changed",
				"payload": map[string]interface{}{
					"device_id": d.DeviceID,
					"name":      d.Name,
					"status":    "offline",
					"field_id":  d.FieldID,
					"user_id":   d.UserID,
				},
			}
			if d.UserID != nil {
				hub.BroadcastToUser(*d.UserID, msg)
			} else {
				hub.BroadcastAll(msg)
			}
		}
	}

	// Update Prometheus metric with current online device count
	sm.updateActiveDeviceMetric()
}

// updateActiveDeviceMetric queries the online device count and updates the Prometheus gauge.
func (sm *StatusManager) updateActiveDeviceMetric() {
	// Count is approximate — we just marked offline devices, so query the remaining online ones.
	// This is a lightweight COUNT(*) query on an indexed column.
	count, err := sm.deviceRepo.CountByStatus(device.DeviceStatusOnline)
	if err != nil {
		log.Printf("Failed to count online devices for metrics: %v", err)
		return
	}
	middleware.SetActiveDevices(count)
}
