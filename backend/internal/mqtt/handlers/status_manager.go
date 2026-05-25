package handlers

import (
	"log"
	"time"

	"github.com/savvyinsight/agrisense/internal/device"
)

// StatusManager handles periodic device status checks and updates
type StatusManager struct {
	deviceRepo       device.DeviceRepository
	heartbeatTimeout time.Duration
	checkInterval    time.Duration
	stop             chan bool
	running          bool
}

// NewStatusManager creates a new device status manager
// heartbeatTimeout: duration after which a device is considered offline (default: 5 minutes)
// checkInterval: interval at which to check for offline devices (default: 1 minute)
func NewStatusManager(deviceRepo device.DeviceRepository, heartbeatTimeout, checkInterval time.Duration) *StatusManager {
	if heartbeatTimeout == 0 {
		heartbeatTimeout = 5 * time.Minute
	}
	if checkInterval == 0 {
		checkInterval = 1 * time.Minute
	}

	return &StatusManager{
		deviceRepo:       deviceRepo,
		heartbeatTimeout: heartbeatTimeout,
		checkInterval:    checkInterval,
		stop:             make(chan bool),
		running:          false,
	}
}

// Start begins the periodic status check loop
func (sm *StatusManager) Start() {
	if sm.running {
		log.Println("Status manager already running")
		return
	}

	sm.running = true
	go sm.checkLoop()
	log.Printf("Device status manager started (heartbeat timeout: %v, check interval: %v)",
		sm.heartbeatTimeout, sm.checkInterval)
}

// Stop stops the status check loop
func (sm *StatusManager) Stop() {
	if !sm.running {
		return
	}
	sm.running = false
	sm.stop <- true
	log.Println("Device status manager stopped")
}

// checkLoop periodically checks for offline devices
func (sm *StatusManager) checkLoop() {
	ticker := time.NewTicker(sm.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-sm.stop:
			return
		case <-ticker.C:
			if err := sm.checkOfflineDevices(); err != nil {
				log.Printf("Error checking offline devices: %v", err)
			}
		}
	}
}

// checkOfflineDevices marks devices as offline if they haven't sent heartbeats recently
func (sm *StatusManager) checkOfflineDevices() error {
	count, err := sm.deviceRepo.MarkOfflineByHeartbeat(sm.heartbeatTimeout)
	if err != nil {
		return err
	}
	if count > 0 {
		log.Printf("Marked %d device(s) as offline (no heartbeat since %v)", count, sm.heartbeatTimeout)
	}
	return nil
}

// MarkDeviceOffline explicitly marks a device as offline
func (sm *StatusManager) MarkDeviceOffline(deviceID string) error {
	if err := sm.deviceRepo.UpdateStatus(deviceID, device.DeviceStatusOffline); err != nil {
		log.Printf("Failed to mark device %s as offline: %v", deviceID, err)
		return err
	}

	log.Printf("Device %s marked as offline", deviceID)
	return nil
}

// MarkDeviceOnline explicitly marks a device as online
func (sm *StatusManager) MarkDeviceOnline(deviceID string) error {
	if err := sm.deviceRepo.UpdateStatus(deviceID, device.DeviceStatusOnline); err != nil {
		log.Printf("Failed to mark device %s as online: %v", deviceID, err)
		return err
	}

	log.Printf("Device %s marked as online", deviceID)
	return nil
}
