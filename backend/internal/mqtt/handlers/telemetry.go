package handlers

import (
	"log"

	"github.com/savvyinsight/agrisense/internal/data"
	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/savvyinsight/agrisense/internal/middleware"
)

var (
	dataService *data.Service
	deviceRepo  device.DeviceRepository
)

// Init sets the data service and device repository for handlers
func Init(ds *data.Service, dr device.DeviceRepository) {
	dataService = ds
	deviceRepo = dr
}

func HandleTelemetry(deviceID string, payload []byte) {
	if dataService == nil {
		log.Println("ERROR: Data service not initialized")
		return
	}

	// Record message for metrics
	middleware.RecordMessage()

	// Auto-register device if it doesn't exist yet
	if deviceRepo != nil {
		if _, err := deviceRepo.FindOrCreate(deviceID); err != nil {
			log.Printf("Failed to find/create device %s: %v", deviceID, err)
		}
		if err := deviceRepo.UpdateStatus(deviceID, device.DeviceStatusOnline); err != nil {
			log.Printf("Failed to update device status to online for %s: %v", deviceID, err)
		}
		if err := deviceRepo.UpdateHeartbeat(deviceID); err != nil {
			log.Printf("Failed to update heartbeat for device %s: %v", deviceID, err)
		}
	}

	if err := dataService.ProcessTelemetry(deviceID, payload); err != nil {
		log.Printf("Failed to process telemetry from device %s: %v", deviceID, err)
	}
}

// type TelemetryData struct {
//     Timestamp time.Time                `json:"timestamp"`
//     Readings  []SensorReading          `json:"readings"`
//     Metadata  map[string]interface{}   `json:"metadata,omitempty"`
// }

// type SensorReading struct {
//     Sensor string  `json:"sensor"` // temperature, humidity, etc.
//     Value  float64 `json:"value"`
// }

// func HandleTelemetry(deviceID string, payload []byte) {
//     log.Printf("Received telemetry from device %s", deviceID)

//     var data TelemetryData
//     if err := json.Unmarshal(payload, &data); err != nil {
//         log.Printf("Failed to parse telemetry from device %s: %v", deviceID, err)
//         return
//     }

//     // TODO: Pass to data service for processing
//     log.Printf("Device %s sent %d readings", deviceID, len(data.Readings))

//     for _, reading := range data.Readings {
//         log.Printf("  - %s: %.2f", reading.Sensor, reading.Value)
//     }
// }
