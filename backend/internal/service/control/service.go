package control

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type Service struct {
	cmdRepo    domain.CommandRepository
	deviceRepo domain.DeviceRepository
	// Remove mqtt.Client - we'll use a callback
	publishFunc func(deviceID string, payload []byte) error
}

func NewService(
	cmdRepo domain.CommandRepository,
	deviceRepo domain.DeviceRepository,
	publishFunc func(deviceID string, payload []byte) error, // Inject behavior
) *Service {
	return &Service{
		cmdRepo:     cmdRepo,
		deviceRepo:  deviceRepo,
		publishFunc: publishFunc,
	}
}

type CommandRequest struct {
	Command    string                 `json:"command" binding:"required"`
	Parameters map[string]interface{} `json:"parameters"`
}

func (s *Service) SendCommand(deviceID int, req CommandRequest, userID *int) (*domain.Command, error) {
	// Get device to verify it exists and get its external ID
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}

	// Create command record
	cmd := &domain.Command{
		DeviceID:   deviceID,
		Command:    req.Command,
		Parameters: req.Parameters,
		Status:     domain.CommandStatusPending,
		UserID:     userID,
		CreatedAt:  time.Now(),
	}

	if err := s.cmdRepo.Create(cmd); err != nil {
		return nil, fmt.Errorf("failed to create command: %w", err)
	}

	// Send via MQTT (async)
	go func() {
		payload := map[string]interface{}{
			"command_id": cmd.ID,
			"command":    req.Command,
			"parameters": req.Parameters,
			"timestamp":  time.Now(),
		}

		data, _ := json.Marshal(payload)

		// Use injected publish function
		if err := s.publishFunc(device.DeviceID, data); err != nil {
			log.Printf("Failed to publish command %d: %v", cmd.ID, err)
			s.cmdRepo.UpdateStatus(cmd.ID, domain.CommandStatusFailed)
			return
		}

		// Update status to sent
		now := time.Now()
		s.cmdRepo.UpdateDelivery(cmd.ID, &now, nil, nil)
	}()

	return cmd, nil
}

func (s *Service) GetCommandStatus(commandID int) (*domain.Command, error) {
	return s.cmdRepo.GetByID(commandID)
}

func (s *Service) GetDeviceCommands(deviceID int, limit int) ([]domain.Command, error) {
	return s.cmdRepo.GetByDeviceID(deviceID, limit)
}

func (s *Service) HandleCommandResponse(deviceID string, payload []byte) {
	var response struct {
		CommandID int    `json:"command_id"`
		Status    string `json:"status"`
		Message   string `json:"message"`
	}

	if err := json.Unmarshal(payload, &response); err != nil {
		log.Printf("Failed to parse command response: %v", err)
		return
	}

	// Find the command
	cmd, err := s.cmdRepo.GetByID(response.CommandID)
	if err != nil {
		log.Printf("Command %d not found: %v", response.CommandID, err)
		return
	}

	// Update based on response status
	now := time.Now()
	switch response.Status {
	case "executed":
		s.cmdRepo.UpdateDelivery(cmd.ID, cmd.SentAt, &now, &now)
	case "failed":
		s.cmdRepo.UpdateStatus(cmd.ID, domain.CommandStatusFailed)
		log.Printf("Command %d failed: %s", cmd.ID, response.Message)
	}
}

func (s *Service) SetPublishFunc(fn func(deviceID string, payload []byte) error) {
	s.publishFunc = fn
}

// ExecuteCommand executes a command (used by automation service)
func (s *Service) ExecuteCommand(deviceID int, command string, parameters map[string]interface{}, userID *int) (*domain.Command, error) {
	// Get device to verify it exists and get its external ID
	device, err := s.deviceRepo.GetByID(deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}

	// Create command record
	cmd := &domain.Command{
		DeviceID:   deviceID,
		Command:    command,
		Parameters: parameters,
		Status:     domain.CommandStatusPending,
		UserID:     userID,
		CreatedAt:  time.Now(),
	}

	if err := s.cmdRepo.Create(cmd); err != nil {
		return nil, fmt.Errorf("failed to create command: %w", err)
	}

	// Send via MQTT (async)
	go func() {
		payload := map[string]interface{}{
			"command_id": cmd.ID,
			"command":    command,
			"parameters": parameters,
			"timestamp":  time.Now(),
		}

		data, _ := json.Marshal(payload)

		// Use injected publish function
		if err := s.publishFunc(device.DeviceID, data); err != nil {
			log.Printf("Failed to publish command %d: %v", cmd.ID, err)
			s.cmdRepo.UpdateStatus(cmd.ID, domain.CommandStatusFailed)
			return
		}

		// Update status to sent
		now := time.Now()
		s.cmdRepo.UpdateDelivery(cmd.ID, &now, nil, nil)
	}()

	return cmd, nil
}
