package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type Simulator struct {
	client   mqtt.Client
	deviceID string
	stopChan chan bool
}

func NewSimulator(deviceID string, broker string) *Simulator {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(fmt.Sprintf("simulator-%s", deviceID))
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)

	client := mqtt.NewClient(opts)

	return &Simulator{
		client:   client,
		deviceID: deviceID,
		stopChan: make(chan bool),
	}
}

func (s *Simulator) Start() error {
	if token := s.client.Connect(); token.Wait() && token.Error() != nil {
		return token.Error()
	}

	log.Printf("Simulator %s connected", s.deviceID)

	// Start heartbeat
	go s.sendHeartbeat()

	// Start telemetry
	go s.sendTelemetry()

	return nil
}

func (s *Simulator) Stop() {
	close(s.stopChan)
	s.client.Disconnect(250)
}

func (s *Simulator) sendHeartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			data := map[string]interface{}{
				"timestamp": time.Now(),
				"rssi":      -50 - rand.Intn(20),
				"battery":   80 + rand.Intn(20),
			}
			payload, _ := json.Marshal(data)
			topic := fmt.Sprintf("device/%s/heartbeat", s.deviceID)
			s.client.Publish(topic, 1, false, payload)
			log.Printf("[%s] Heartbeat sent", s.deviceID)
		}
	}
}

func (s *Simulator) sendTelemetry() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	// 20% chance of high temperature
	var temp float64
	if rand.Float32() < 0.2 {
		temp = 32 + rand.Float64()*8 // 32-40°C (alert zone)
	} else {
		temp = 20 + rand.Float64()*8 // 20-28°C (normal)
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
					{"sensor": "humidity", "value": 50 + rand.Float64()*20},
					{"sensor": "soil_moisture", "value": 30 + rand.Float64()*40},
					{"sensor": "light_intensity", "value": 1000 + rand.Float64()*9000},
				},
			}
			payload, _ := json.Marshal(data)
			topic := fmt.Sprintf("device/%s/telemetry", s.deviceID)
			s.client.Publish(topic, 1, false, payload)
			log.Printf("[%s] Telemetry sent", s.deviceID)
		}
	}
}

func main() {
	rand.Seed(time.Now().UnixNano())

	// Create 3 simulators
	simulators := make([]*Simulator, 3)
	for i := range simulators {
		deviceID := fmt.Sprintf("sim-device-%02d", i+1)
		sim := NewSimulator(deviceID, "tcp://localhost:1883")
		simulators[i] = sim

		if err := sim.Start(); err != nil {
			log.Fatalf("Failed to start simulator %s: %v", deviceID, err)
		}
	}

	log.Println("All simulators running. Press Ctrl+C to stop.")

	// Wait for interrupt
	<-make(chan struct{})

	// Cleanup
	for _, sim := range simulators {
		sim.Stop()
	}
}
