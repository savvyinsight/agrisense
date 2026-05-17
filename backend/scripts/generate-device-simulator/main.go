package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var messagePubHandler mqtt.MessageHandler = func(client mqtt.Client, msg mqtt.Message) {
	deviceID := extractDeviceID(msg.Topic())
	log.Printf("[%s] ⬅ Received command on %s: %s", deviceID, msg.Topic(), string(msg.Payload()))

	var payload map[string]interface{}
	if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
		log.Printf("[%s] Bad JSON: %v", deviceID, err)
		return
	}

	cmdID, hasID := payload["command_id"]
	if !hasID {
		log.Printf("[%s] No command_id in payload, ignoring", deviceID)
		return
	}

	command, _ := payload["command"].(string)
	respTopic := fmt.Sprintf("device/%s/response", deviceID)
	response := map[string]interface{}{
		"command_id": cmdID,
		"status":     "executed",
		"message":    fmt.Sprintf("Command '%s' executed by %s", command, deviceID),
	}
	respPayload, _ := json.Marshal(response)
	token := client.Publish(respTopic, 1, false, respPayload)
	token.Wait()
	if token.Error() != nil {
		log.Printf("[%s] Failed to publish response: %v", deviceID, token.Error())
	} else {
		log.Printf("[%s] ➡ Response sent: %s", deviceID, string(respPayload))
	}
}

type TelemetrySimulator struct {
	client    mqtt.Client
	deviceID  string
	stopChan  chan bool
	rng       *rand.Rand
}

func NewTelemetrySimulator(deviceID string, broker string) *TelemetrySimulator {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(fmt.Sprintf("sim-%s", deviceID))
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	client := mqtt.NewClient(opts)
	return &TelemetrySimulator{
		client:   client,
		deviceID: deviceID,
		stopChan: make(chan bool),
		rng:      rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *TelemetrySimulator) Start() error {
	if token := s.client.Connect(); token.Wait() && token.Error() != nil {
		return token.Error()
	}
	log.Printf("[%s] Connected", s.deviceID)

	// Subscribe to commands so this device responds to irrigation start/stop
	cmdTopic := fmt.Sprintf("device/%s/commands", s.deviceID)
	token := s.client.Subscribe(cmdTopic, 1, messagePubHandler)
	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("subscribe %s: %w", cmdTopic, token.Error())
	}
	log.Printf("[%s] Subscribed to %s", s.deviceID, cmdTopic)

	go s.sendHeartbeat()
	go s.sendTelemetry()
	return nil
}

func (s *TelemetrySimulator) Stop() {
	close(s.stopChan)
	s.client.Disconnect(250)
}

func (s *TelemetrySimulator) sendHeartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			data := map[string]interface{}{
				"timestamp": time.Now(),
				"rssi":      -50 - s.rng.Intn(20),
				"battery":   80 + s.rng.Intn(20),
			}
			payload, _ := json.Marshal(data)
			topic := fmt.Sprintf("device/%s/heartbeat", s.deviceID)
			s.client.Publish(topic, 1, false, payload)
			log.Printf("[%s] Heartbeat sent", s.deviceID)
		}
	}
}

func (s *TelemetrySimulator) sendTelemetry() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	var temp float64
	if s.rng.Float32() < 0.2 {
		temp = 32 + s.rng.Float64()*8
	} else {
		temp = 20 + s.rng.Float64()*8
	}
	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			data := map[string]interface{}{
				"timestamp": time.Now(),
				"readings": []map[string]interface{}{
					{"sensor": "temperature", "value": temp},
					{"sensor": "humidity", "value": 50 + s.rng.Float64()*20},
					{"sensor": "soil_moisture", "value": 30 + s.rng.Float64()*40},
					{"sensor": "light_intensity", "value": 1000 + s.rng.Float64()*9000},
				},
			}
			payload, _ := json.Marshal(data)
			topic := fmt.Sprintf("device/%s/telemetry", s.deviceID)
			s.client.Publish(topic, 1, false, payload)
			log.Printf("[%s] Telemetry sent", s.deviceID)
		}
	}
}

func extractDeviceID(topic string) string {
	parts := strings.Split(topic, "/")
	if len(parts) >= 2 {
		return parts[1]
	}
	return "unknown"
}

func main() {
	defaultDevices := []string{"sim-device-01", "sim-device-02", "sim-device-03"}
	broker := "tcp://localhost:1883"

	args := os.Args[1:]
	var deviceIDs []string
	for _, arg := range args {
		if strings.HasPrefix(arg, "--broker=") {
			broker = strings.TrimPrefix(arg, "--broker=")
		} else if !strings.HasPrefix(arg, "-") {
			deviceIDs = append(deviceIDs, arg)
		}
	}
	if len(deviceIDs) == 0 {
		deviceIDs = defaultDevices
	}

	log.Printf("Starting device simulators (broker: %s)", broker)
	log.Printf("Devices: %s", strings.Join(deviceIDs, ", "))

	simulators := make([]*TelemetrySimulator, len(deviceIDs))
	for i, id := range deviceIDs {
		sim := NewTelemetrySimulator(id, broker)
		simulators[i] = sim
		if err := sim.Start(); err != nil {
			log.Fatalf("Failed to start simulator %s: %v", id, err)
		}
	}

	log.Println("All simulators running. Press Ctrl+C to stop.")
	log.Println("Tip: pass device IDs as args, e.g.: go run . D260517-QSPO D260517-I25Q")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down...")
	for _, sim := range simulators {
		sim.Stop()
	}
}
