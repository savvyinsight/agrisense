package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type DeviceState struct {
	mu             sync.Mutex
	deviceID       string
	isController   bool

	// Sensor readings (updated per tick)
	moisture    float64
	temperature float64
	humidity    float64
	light       float64

	// Controller state (controllers only)
	irrigating bool
	irrigatingSince time.Time

	rng    *rand.Rand
	baseTemp float64
	startedAt time.Time
}

func NewDeviceState(deviceID string, isController bool) *DeviceState {
	now := time.Now()
	rng := rand.New(rand.NewSource(now.UnixNano()))
	return &DeviceState{
		deviceID:     deviceID,
		isController: isController,
		moisture:     30 + rng.Float64()*20,
		temperature:  22 + rng.Float64()*6,
		humidity:     55 + rng.Float64()*15,
		light:        0,
		baseTemp:     22 + rng.Float64()*4,
		rng:          rng,
		startedAt:    now,
	}
}

func (s *DeviceState) Tick() {
	s.mu.Lock()
	defer s.mu.Unlock()

	hours := time.Since(s.startedAt).Hours()
	hourOfDay := math.Mod(hours, 24)

	// Diurnal temperature: peak at 14:00, trough at 04:00
	// ~25°C ± 8°C based on time of day
	tempAngle := (hourOfDay - 14) / 24 * 2 * math.Pi
	s.temperature = s.baseTemp - 8*math.Cos(tempAngle) + (s.rng.Float64()-0.5)*1.5
	if s.temperature < 5 {
		s.temperature = 5
	}

	// Humidity inversely related to temp, 40-90% range
	s.humidity = 85 - (s.temperature-s.baseTemp)*1.5 + (s.rng.Float64()-0.5)*5
	if s.humidity < 30 {
		s.humidity = 30
	}
	if s.humidity > 95 {
		s.humidity = 95
	}

	// Light intensity (lux): bell curve around solar noon (12:00)
	lightHour := hourOfDay - 12
	if lightHour < -6 || lightHour > 6 {
		s.light = 0
	} else {
		normalized := lightHour / 6
		s.light = 100000 * math.Exp(-normalized*normalized*3)
		s.light += s.rng.Float64() * 5000
	}

	// Soil moisture: decays when not irrigating, recovers when irrigating
	if s.irrigating {
		elapsed := time.Since(s.irrigatingSince).Minutes()
		if elapsed < 2 {
			// Ramp up to 80% over 2 minutes
			s.moisture = 40 + 40*(elapsed/2)
		} else if elapsed < 30 {
			// Hold at 80%
			s.moisture = 80
		} else {
			// Slowly decline after 30 min
			s.moisture = 80 - (elapsed-30)*0.2
		}
		if s.moisture > 85 {
			s.moisture = 85
		}
	} else {
		// Natural decay: 0.3% per tick (10s = 1.8%/min)
		s.moisture -= 0.3
	}
	if s.moisture < 0 {
		s.moisture = 0
	}
	if s.moisture > 100 {
		s.moisture = 100
	}
}

func (s *DeviceState) Readings() []map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return []map[string]interface{}{
		{"sensor": "temperature", "value": math.Round(s.temperature*10) / 10},
		{"sensor": "humidity", "value": math.Round(s.humidity)},
		{"sensor": "soil_moisture", "value": math.Round(s.moisture*10) / 10},
		{"sensor": "light_intensity", "value": math.Round(s.light)},
	}
}

func (s *DeviceState) Heartbeat() map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return map[string]interface{}{
		"timestamp": time.Now(),
		"rssi":      -50 - s.rng.Intn(25),
		"battery":   max(15, 95-int(time.Since(s.startedAt).Hours()/24*5)),
	}
}

func (s *DeviceState) StartIrrigation() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.irrigating = true
	s.irrigatingSince = time.Now()
	log.Printf("[%s] Irrigation started", s.deviceID)
}

func (s *DeviceState) StopIrrigation() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.irrigating = false
	log.Printf("[%s] Irrigation stopped (moisture=%.1f%%)", s.deviceID, s.moisture)
}

// ---

type Simulator struct {
	client   mqtt.Client
	states   []*DeviceState
	stopChan chan bool
	broker   string
}

func NewSimulator(broker string, deviceIDs []string) *Simulator {
	states := make([]*DeviceState, len(deviceIDs))
	for i, id := range deviceIDs {
		isCtrl := strings.HasPrefix(id, "CTRL-")
		states[i] = NewDeviceState(id, isCtrl)
	}

	opts := mqtt.NewClientOptions()
	opts.AddBroker(broker)
	opts.SetClientID(fmt.Sprintf("sim-all-%d", time.Now().Unix()))
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	client := mqtt.NewClient(opts)

	return &Simulator{
		client:   client,
		states:   states,
		stopChan: make(chan bool),
		broker:   broker,
	}
}

func (sim *Simulator) Start() error {
	if token := sim.client.Connect(); token.Wait() && token.Error() != nil {
		return fmt.Errorf("connect: %w", token.Error())
	}
	log.Printf("Connected to %s with %d device(s)", sim.broker, len(sim.states))

	// Subscribe to commands for all devices
	for _, s := range sim.states {
		if s.isController {
			topic := fmt.Sprintf("device/%s/commands", s.deviceID)
			token := sim.client.Subscribe(topic, 1, sim.makeCommandHandler(s))
			token.Wait()
			if token.Error() != nil {
				return fmt.Errorf("subscribe %s: %w", topic, token.Error())
			}
			log.Printf("[%s] Subscribed to commands", s.deviceID)
		}
	}

	// Start telemetry loop
	go sim.loop()
	return nil
}

func (sim *Simulator) Stop() {
	close(sim.stopChan)
	sim.client.Disconnect(250)
}

func (sim *Simulator) makeCommandHandler(state *DeviceState) mqtt.MessageHandler {
	return func(client mqtt.Client, msg mqtt.Message) {
		var payload map[string]interface{}
		if err := json.Unmarshal(msg.Payload(), &payload); err != nil {
			log.Printf("[%s] Bad JSON: %v", state.deviceID, err)
			return
		}

		cmdID, hasID := payload["command_id"]
		if !hasID {
			log.Printf("[%s] No command_id, ignoring", state.deviceID)
			return
		}

		command, _ := payload["command"].(string)
		log.Printf("[%s] Command received: %s (id=%v)", state.deviceID, command, cmdID)

		switch command {
		case "irrigation_start":
			state.StartIrrigation()
		case "irrigation_stop":
			state.StopIrrigation()
		case "irrigation_retry":
			state.StartIrrigation()
		}

		respTopic := fmt.Sprintf("device/%s/response", state.deviceID)
		response := map[string]interface{}{
			"command_id": cmdID,
			"status":     "executed",
			"message":    fmt.Sprintf("Command '%s' executed by %s", command, state.deviceID),
		}
		respPayload, _ := json.Marshal(response)
		token := client.Publish(respTopic, 1, false, respPayload)
		token.Wait()
		if token.Error() != nil {
			log.Printf("[%s] Failed to publish response: %v", state.deviceID, token.Error())
		} else {
			log.Printf("[%s] Response sent", state.deviceID)
		}
	}
}

func (sim *Simulator) loop() {
	tick := time.NewTicker(10 * time.Second)
	heartbeat := time.NewTicker(30 * time.Second)
	defer tick.Stop()
	defer heartbeat.Stop()

	for {
		select {
		case <-sim.stopChan:
			return
		case <-tick.C:
			for _, s := range sim.states {
				s.Tick()
				readings := s.Readings()
				topic := fmt.Sprintf("device/%s/telemetry", s.deviceID)
				payload, _ := json.Marshal(map[string]interface{}{
					"timestamp": time.Now(),
					"readings":  readings,
				})
				sim.client.Publish(topic, 1, false, payload)
			}
		case <-heartbeat.C:
			for _, s := range sim.states {
				topic := fmt.Sprintf("device/%s/heartbeat", s.deviceID)
				payload, _ := json.Marshal(s.Heartbeat())
				sim.client.Publish(topic, 1, false, payload)
			}
		}
	}
}

func main() {
	defaultDevices := []string{"SEN-NTH-TEMP", "SEN-NTH-SOIL", "CTRL-NTH", "SEN-STH-TEMP", "SEN-STH-SOIL", "CTRL-STH"}
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

	log.Printf("Starting device simulator (broker: %s)", broker)
	log.Printf("Devices: %s", strings.Join(deviceIDs, ", "))
	log.Println("")
	log.Println("Telemetry:    every 10s  (temp, humidity, moisture, light)")
	log.Println("Heartbeat:    every 30s  (rssi, battery)")
	log.Println("Controllers:  subscribe to commands, respond with executed status")
	log.Println("Moisture:     decays 1.8%/min; jumps to 80% on irrigation_start, holds 30min")
	log.Println("Temperature:  diurnal cycle (peak 14:00, trough 04:00)")
	log.Println("")

	sim := NewSimulator(broker, deviceIDs)
	if err := sim.Start(); err != nil {
		log.Fatalf("Failed to start: %v", err)
	}

	// Print active device IDs and their states
	for _, s := range sim.states {
		role := "sensor"
		if s.isController {
			role = "controller"
		}
		log.Printf("  %s (%s)", s.deviceID, role)
	}

	log.Println("")
	log.Println("All simulators running. Press Ctrl+C to stop.")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig

	log.Println("Shutting down...")
	sim.Stop()
}
