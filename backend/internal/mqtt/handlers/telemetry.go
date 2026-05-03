package handlers

import (
	"log"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
	"github.com/savvyinsight/agrisenseiot/internal/middleware"
	"github.com/savvyinsight/agrisenseiot/internal/service/data"
)

var (
	dataService *data.Service
	deviceRepo  domain.DeviceRepository
)

// Init sets the data service and device repository for handlers
func Init(ds *data.Service, dr domain.DeviceRepository) {
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

	// Mark device as online when telemetry is received
	if deviceRepo != nil {
		if err := deviceRepo.UpdateStatus(deviceID, domain.DeviceStatusOnline); err != nil {
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
