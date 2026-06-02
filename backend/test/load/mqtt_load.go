//go:build ignore

package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// ── Configuration ────────────────────────────────────────────────────────

type Config struct {
	Broker     string
	NumDevices int
	TargetRate int // messages per second
	Duration   time.Duration
	BatchSize  int
}

func main() {
	cfg := Config{}
	flag.StringVar(&cfg.Broker, "broker", "tcp://localhost:1883", "MQTT broker URL")
	flag.IntVar(&cfg.NumDevices, "devices", 100, "Number of simulated devices")
	flag.IntVar(&cfg.TargetRate, "rate", 2300, "Target messages per second")
	flag.DurationVar(&cfg.Duration, "duration", 60*time.Second, "Test duration")
	flag.IntVar(&cfg.BatchSize, "batch", 100, "Messages per batch")
	flag.Parse()

	fmt.Println("=== MQTT Load Test ===")
	fmt.Printf("Broker:     %s\n", cfg.Broker)
	fmt.Printf("Devices:    %d\n", cfg.NumDevices)
	fmt.Printf("Target:     %d msg/s\n", cfg.TargetRate)
	fmt.Printf("Duration:   %s\n", cfg.Duration)
	fmt.Printf("Batch size: %d\n", cfg.BatchSize)
	fmt.Println()

	// ── Generate device IDs ──────────────────────────────────────────
	deviceIDs := make([]string, cfg.NumDevices)
	for i := range deviceIDs {
		deviceIDs[i] = fmt.Sprintf("sensor-%03d", i+1)
	}

	// ── Connect MQTT clients ─────────────────────────────────────────
	fmt.Printf("Connecting %d MQTT clients ... ", cfg.NumDevices)
	clients := connectClients(cfg.Broker, deviceIDs)
	fmt.Printf("%d connected\n", len(clients))

	// ── Run load test ────────────────────────────────────────────────
	fmt.Println("Starting message flood ...")
	result := runLoadTest(clients, cfg)

	// ── Report ───────────────────────────────────────────────────────
	printReport(result)
	saveReport(result)

	// ── Cleanup ──────────────────────────────────────────────────────
	fmt.Println("\nCleaning up ...")
	for _, c := range clients {
		c.client.Disconnect(250)
	}
}

// ── MQTT Client Setup ────────────────────────────────────────────────────

type deviceClient struct {
	client   mqtt.Client
	deviceID string
}

func connectClients(broker string, deviceIDs []string) []deviceClient {
	var (
		mu      sync.Mutex
		clients []deviceClient
		wg      sync.WaitGroup
	)

	for _, id := range deviceIDs {
		wg.Add(1)
		go func(deviceID string) {
			defer wg.Done()

			opts := mqtt.NewClientOptions()
			opts.AddBroker(broker)
			opts.SetClientID("loadtest-" + deviceID)
			opts.SetCleanSession(true)
			opts.SetConnectTimeout(5 * time.Second)
			opts.SetAutoReconnect(false)
			// QoS 1: broker ACKs on receipt — this is what we measure
			opts.SetWriteTimeout(5 * time.Second)

			c := mqtt.NewClient(opts)
			token := c.Connect()
			token.Wait()
			if token.Error() != nil {
				fmt.Fprintf(os.Stderr, "\n  WARN: %s connect failed: %v\n", deviceID, token.Error())
				return
			}

			mu.Lock()
			clients = append(clients, deviceClient{client: c, deviceID: deviceID})
			mu.Unlock()
		}(id)
	}
	wg.Wait()
	return clients
}

// ── Telemetry Generation ─────────────────────────────────────────────────

type reading struct {
	Sensor string  `json:"sensor"`
	Value  float64 `json:"value"`
}

type telemetryPayload struct {
	Timestamp string    `json:"timestamp"`
	Readings  []reading `json:"readings"`
	Metadata  struct {
		DeviceID    string `json:"device_id"`
		FirmwareVer string `json:"firmware_version"`
	} `json:"metadata"`
}

func generateTelemetry(deviceID string) telemetryPayload {
	sensors := []string{"temperature", "humidity", "soil_moisture", "light_intensity"}
	sensor := sensors[rand.Intn(len(sensors))]

	var value float64
	switch sensor {
	case "temperature":
		value = 15 + rand.Float64()*25
	case "humidity":
		value = 30 + rand.Float64()*50
	case "soil_moisture":
		value = 10 + rand.Float64()*80
	case "light_intensity":
		value = 1000 + rand.Float64()*9000
	}

	return telemetryPayload{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Readings:  []reading{{Sensor: sensor, Value: math.Round(value*100) / 100}},
		Metadata: struct {
			DeviceID    string `json:"device_id"`
			FirmwareVer string `json:"firmware_version"`
		}{DeviceID: deviceID, FirmwareVer: "1.2.3"},
	}
}

// ── Load Test Execution ──────────────────────────────────────────────────

type testResult struct {
	Duration    time.Duration
	TotalSent   int64
	TotalFailed int64
	ActualRate  float64
	Latencies   []time.Duration
	P50         time.Duration
	P90         time.Duration
	P95         time.Duration
	P99         time.Duration
	Min         time.Duration
	Max         time.Duration
	Avg         time.Duration
	DeviceCount int
	TargetRate  int
}

func runLoadTest(clients []deviceClient, cfg Config) testResult {
	var (
		totalSent   atomic.Int64
		totalFailed atomic.Int64
		latencyMu   sync.Mutex
		latencies   []time.Duration
	)

	// Interval between batches
	intervalMs := time.Duration(float64(cfg.BatchSize) / float64(cfg.TargetRate) * float64(time.Second))
	totalBatches := int(float64(cfg.TargetRate)*cfg.Duration.Seconds()) / cfg.BatchSize

	var wg sync.WaitGroup
	stop := make(chan struct{})
	batchCount := atomic.Int64{}

	startTime := time.Now()

	// Publisher goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(intervalMs)
		defer ticker.Stop()

		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				if int(batchCount.Load()) >= totalBatches {
					return
				}
				batchCount.Add(1)

				// Send a batch
				for i := 0; i < cfg.BatchSize; i++ {
					idx := rand.Intn(len(clients))
					dc := clients[idx]

					payload := generateTelemetry(dc.deviceID)
					payloadBytes, _ := json.Marshal(payload)
					topic := "device/" + dc.deviceID + "/telemetry"

					// QoS 1: measure time from publish to broker ACK
					start := time.Now()
					token := dc.client.Publish(topic, 1, false, payloadBytes)
					token.Wait()
					elapsed := time.Since(start)

					if token.Error() != nil {
						totalFailed.Add(1)
					} else {
						totalSent.Add(1)
						latencyMu.Lock()
						latencies = append(latencies, elapsed)
						latencyMu.Unlock()
					}
				}

				// Progress reporting
				sent := totalSent.Load()
				if sent > 0 && sent%int64(cfg.BatchSize*10) == 0 {
					elapsed := time.Since(startTime)
					rate := float64(sent) / elapsed.Seconds()
					fmt.Printf("\r  %d msgs sent, %.0f msg/s", sent, rate)
				}
			}
		}
	}()

	time.Sleep(cfg.Duration + 2*time.Second) // extra 2s for last batches
	close(stop)
	wg.Wait()

	// Compute statistics
	actualDuration := time.Since(startTime)
	sent := totalSent.Load()
	actualRate := float64(sent) / actualDuration.Seconds()

	result := testResult{
		Duration:    actualDuration,
		TotalSent:   sent,
		TotalFailed: totalFailed.Load(),
		ActualRate:  actualRate,
		DeviceCount: len(clients),
		TargetRate:  cfg.TargetRate,
	}

	latencyMu.Lock()
	result.Latencies = make([]time.Duration, len(latencies))
	copy(result.Latencies, latencies)
	latencyMu.Unlock()

	if len(result.Latencies) > 0 {
		sort.Slice(result.Latencies, func(i, j int) bool {
			return result.Latencies[i] < result.Latencies[j]
		})
		n := len(result.Latencies)
		result.P50 = result.Latencies[n*50/100]
		result.P90 = result.Latencies[n*90/100]
		result.P95 = result.Latencies[n*95/100]
		result.P99 = result.Latencies[int(math.Min(float64(n*99/100), float64(n-1)))]
		result.Min = result.Latencies[0]
		result.Max = result.Latencies[n-1]

		var sum time.Duration
		for _, l := range result.Latencies {
			sum += l
		}
		result.Avg = sum / time.Duration(n)
	}

	return result
}

// ── Reporting ────────────────────────────────────────────────────────────

func printReport(r testResult) {
	fmt.Println("\n\n" + "=" + repeat("=", 50))
	fmt.Println("  LOAD TEST RESULTS")
	fmt.Println("=" + repeat("=", 50))

	fmt.Printf("\n  Duration:     %s\n", r.Duration.Round(time.Millisecond))
	fmt.Printf("  Devices:      %d\n", r.DeviceCount)
	fmt.Printf("  Sent:         %d\n", r.TotalSent)
	fmt.Printf("  Failed:       %d\n", r.TotalFailed)
	fmt.Printf("  Throughput:   %.0f msg/s\n", r.ActualRate)

	fmt.Println("\n  Latency (QoS 1 broker ACK):")
	fmt.Printf("    Min:  %s\n", r.Min)
	fmt.Printf("    Avg:  %s\n", r.Avg)
	fmt.Printf("    P50:  %s\n", r.P50)
	fmt.Printf("    P90:  %s\n", r.P90)
	fmt.Printf("    P95:  %s\n", r.P95)
	fmt.Printf("    P99:  %s\n", r.P99)
	fmt.Printf("    Max:  %s\n", r.Max)

	fmt.Println("\n  Target Assessment:")
	fmt.Printf("    Target:     %d msg/s\n", r.TargetRate)
	fmt.Printf("    Achieved:   %.0f msg/s\n", r.ActualRate)
	if r.ActualRate >= float64(r.TargetRate) {
		fmt.Printf("    Status:     ✅ SUCCESS\n")
	} else {
		fmt.Printf("    Status:     ❌ FAILED (%.0f below target)\n", float64(r.TargetRate)-r.ActualRate)
	}
}

func saveReport(r testResult) {
	dir := "results"
	os.MkdirAll(dir, 0o755)

	filename := filepath.Join(dir, fmt.Sprintf("mqtt-load-%s.txt", time.Now().Format("20060102-150405")))
	f, err := os.Create(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "WARN: could not save report: %v\n", err)
		return
	}
	defer f.Close()

	fmt.Fprintf(f, "MQTT Load Test Report\n")
	fmt.Fprintf(f, "Generated: %s\n\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "Config:\n")
	fmt.Fprintf(f, "  Devices:  %d\n", r.DeviceCount)
	fmt.Fprintf(f, "  Target:   %d msg/s\n\n", r.TargetRate)
	fmt.Fprintf(f, "Results:\n")
	fmt.Fprintf(f, "  Duration:     %s\n", r.Duration.Round(time.Millisecond))
	fmt.Fprintf(f, "  Total sent:   %d\n", r.TotalSent)
	fmt.Fprintf(f, "  Total failed: %d\n", r.TotalFailed)
	fmt.Fprintf(f, "  Throughput:   %.0f msg/s\n\n", r.ActualRate)
	fmt.Fprintf(f, "Latency (QoS 1 broker ACK):\n")
	fmt.Fprintf(f, "  Min:  %s\n", r.Min)
	fmt.Fprintf(f, "  Avg:  %s\n", r.Avg)
	fmt.Fprintf(f, "  P50:  %s\n", r.P50)
	fmt.Fprintf(f, "  P90:  %s\n", r.P90)
	fmt.Fprintf(f, "  P95:  %s\n", r.P95)
	fmt.Fprintf(f, "  P99:  %s\n", r.P99)
	fmt.Fprintf(f, "  Max:  %s\n", r.Max)

	fmt.Printf("\nReport saved to: %s\n", filename)
}

func repeat(s string, n int) string {
	result := ""
	for i := 0; i < n; i++ {
		result += s
	}
	return result
}
