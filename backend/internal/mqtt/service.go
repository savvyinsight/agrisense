package mqtt

import (
	"log"

	"github.com/savvyinsight/agrisense/internal/data"
)

type Service struct {
	client          *Client
	dataService     *data.Service
	responseHandler func(deviceID string, payload []byte) // Add this
}

func NewService(cfg Config,
	dataService *data.Service,
	telemetryHandler func(deviceID string, payload []byte),
	heartbeatHandler func(deviceID string, payload []byte),
	responseHandler func(deviceID string, payload []byte),
	statusHandler func(deviceID string, payload []byte), // LWT / device status
) (*Service, error) {
	// Store handlers directly
	handlers := &Handlers{
		TelemetryHandler: telemetryHandler,
		HeartbeatHandler: heartbeatHandler,
		ResponseHandler:  responseHandler,
		StatusHandler:    statusHandler,
	}

	client, err := NewClient(cfg, handlers)
	if err != nil {
		return nil, err
	}

	return &Service{
		client:          client,
		dataService:     dataService,
		responseHandler: responseHandler,
	}, nil
}

func (s *Service) Start() error {
	log.Println("Starting MQTT service...")
	return s.client.Subscribe()
}

func (s *Service) Stop() {
	if s.client != nil {
		s.client.Disconnect()
	}
}

func (s *Service) SendCommand(deviceID string, command []byte) error {
	return s.client.PublishCommand(deviceID, command)
}

func (s *Service) SendConfig(deviceID string, config []byte) error {
	return s.client.PublishConfig(deviceID, config)
}
