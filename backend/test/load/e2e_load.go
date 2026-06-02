//go:build ignore

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

// ── Configuration ────────────────────────────────────────────────────────

type Config struct {
	Broker    string
	API       string
	NumDevices int
	TargetRate int
	Duration  time.Duration
	BatchSize int
	APIUser   string
	APIPass   string
	InfluxURL string
	InfluxToken string
	InfluxOrg string
	InfluxBucket string
}

// ── Types ────────────────────────────────────────────────────────────────

type reading struct {
	Sensor string  `json:"sensor"`
	Value  float64 `json:"value"`
}

type telemetryPayload struct {
	SeqID     int64     `json:"seq_id"`
	Timestamp string    `json:"timestamp"`
	Readings  []reading `json:"readings"`
	Metadata  struct {
		DeviceID    string `json:"device_id"`
		FirmwareVer string `json:"firmware_version"`
	} `json:"metadata"`
}

type sentMessage struct {
	SeqID          int64
	DeviceID       string
	SensorType     string
	SentAt         time.Time
	PayloadAt      time.Time
	BrokerAckAt    time.Time
	BrokerAckDelta time.Duration
}

type e2eResult struct {
	Duration      time.Duration
	DeviceCount   int
	TargetRate    int
	TotalSent     int64
	TotalFailed   int64
	ActualRate    float64
	BrokerAckP50  time.Duration
	BrokerAckP90  time.Duration
	BrokerAckP95  time.Duration
	BrokerAckP99  time.Duration
	BrokerAckMin  time.Duration
	BrokerAckMax  time.Duration
	BrokerAckAvg  time.Duration
	TotalStored   int64
	DataLossPct   float64
	ProcessedRate float64
	E2ELatencyP50 time.Duration
	E2ELatencyP90 time.Duration
	E2ELatencyP95 time.Duration
	E2ELatencyP99 time.Duration
	E2EMin        time.Duration
	E2EMax        time.Duration
	E2EAvg        time.Duration
}

type loginResponse struct {
	Token string `json:"token"`
}

type deviceClient struct {
	client   mqtt.Client
	deviceID string
}

// ── Main ─────────────────────────────────────────────────────────────────

func main() {
	cfg := Config{}
	flag.StringVar(&cfg.Broker, "broker", "tcp://localhost:1883", "MQTT broker URL")
	flag.StringVar(&cfg.API, "api", "http://localhost:8080", "API base URL")
	flag.IntVar(&cfg.NumDevices, "devices", 100, "Number of simulated devices")
	flag.IntVar(&cfg.TargetRate, "rate", 2300, "Target messages per second")
	flag.DurationVar(&cfg.Duration, "duration", 60*time.Second, "Test duration")
	flag.IntVar(&cfg.BatchSize, "batch", 100, "Messages per batch")
	flag.StringVar(&cfg.APIUser, "api-user", "perf-test@example.com", "Test user email")
	flag.StringVar(&cfg.APIPass, "api-pass", "test123", "Test user password")
	flag.StringVar(&cfg.InfluxURL, "influx-url", "http://localhost:8086", "InfluxDB URL")
	flag.StringVar(&cfg.InfluxToken, "influx-token", "my-super-secret-token", "InfluxDB token")
	flag.StringVar(&cfg.InfluxOrg, "influx-org", "agrisense", "InfluxDB org")
	flag.StringVar(&cfg.InfluxBucket, "influx-bucket", "sensor_data", "InfluxDB bucket")
	flag.Parse()

	printConfig(cfg)

	// ── Phase 1: Setup ──────────────────────────────────────────────
	fmt.Println("\n── Phase 1: Setup ──────────────────────────────────")
	deviceIDs := setupDevices(cfg)
	if len(deviceIDs) == 0 {
		log.Fatal("No devices available for testing")
	}
	fmt.Printf("  Devices ready: %d\n", len(deviceIDs))

	// ── Phase 2: Execute MQTT load test ─────────────────────────────
	fmt.Println("\n── Phase 2: Execute ─────────────────────────────────")
	clients := connectClients(cfg.Broker, deviceIDs)
	if len(clients) == 0 {
		log.Fatal("No MQTT clients connected")
	}
	fmt.Printf("  Connected: %d/%d clients\n", len(clients), len(deviceIDs))

	testStart := time.Now()
	messages, result := executeLoadTest(clients, cfg)
	testEnd := time.Now()
	result.Duration = testEnd.Sub(testStart)
	result.DeviceCount = len(clients)
	result.TargetRate = cfg.TargetRate

	// Disconnect MQTT clients
	for _, c := range clients {
		c.client.Disconnect(250)
	}

	// ── Phase 3: Verify against InfluxDB ────────────────────────────
	fmt.Println("\n── Phase 3: Verify ──────────────────────────────────")
	fmt.Print("  Waiting 10s for backend to flush pending writes ... ")
	time.Sleep(10 * time.Second)
	fmt.Println("done")

	verifyResult := verifyAgainstInfluxDB(messages, cfg, testStart, testEnd)
	result.TotalStored = verifyResult.TotalStored
	result.DataLossPct = verifyResult.DataLossPct
	result.ProcessedRate = verifyResult.ProcessedRate
	result.E2ELatencyP50 = verifyResult.E2ELatencyP50
	result.E2ELatencyP90 = verifyResult.E2ELatencyP90
	result.E2ELatencyP95 = verifyResult.E2ELatencyP95
	result.E2ELatencyP99 = verifyResult.E2ELatencyP99
	result.E2EMin = verifyResult.E2EMin
	result.E2EMax = verifyResult.E2EMax
	result.E2EAvg = verifyResult.E2EAvg

	// ── Report ──────────────────────────────────────────────────────
	fmt.Println("\n── Results ──────────────────────────────────────────")
	printReport(result)
	saveReport(result)
}

// ── Phase 1: Setup ───────────────────────────────────────────────────────

func setupDevices(cfg Config) []string {
	client := &http.Client{Timeout: 10 * time.Second}

	// Register user (ignore if exists)
	fmt.Printf("  Registering user %s ... ", cfg.APIUser)
	if err := registerUser(client, cfg.API, "perf-test", cfg.APIUser, cfg.APIPass); err != nil {
		fmt.Printf("skipped (%v)\n", err)
	} else {
		fmt.Println("ok")
	}

	// Login
	fmt.Printf("  Logging in ... ")
	token, err := loginUser(client, cfg.API, cfg.APIUser, cfg.APIPass)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("ok")

	// Create devices
	fmt.Printf("  Creating %d devices ... ", cfg.NumDevices)
	var deviceIDs []string
	created, skipped := 0, 0
	for i := 1; i <= cfg.NumDevices; i++ {
		deviceID := fmt.Sprintf("sensor-%03d", i)
		name := fmt.Sprintf("E2E Test Sensor %d", i)

		err := createDevice(client, cfg.API, token, deviceID, name)
		if err == nil {
			created++
		} else if isDuplicate(err) {
			skipped++
		} else {
			fmt.Fprintf(os.Stderr, "\n    WARN: %s: %v\n", deviceID, err)
		}
		deviceIDs = append(deviceIDs, deviceID)
	}
	fmt.Printf("done (%d created, %d existed)\n", created, skipped)

	return deviceIDs
}

func registerUser(client *http.Client, apiURL, username, email, password string) error {
	body := map[string]string{"username": username, "email": email, "password": password}
	resp, err := postJSON(client, apiURL+"/api/v1/auth/register", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusConflict {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
}

func loginUser(client *http.Client, apiURL, email, password string) (string, error) {
	body := map[string]string{"email": email, "password": password}
	resp, err := postJSON(client, apiURL+"/api/v1/auth/login", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	var lr loginResponse
	if err := json.NewDecoder(resp.Body).Decode(&lr); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if lr.Token == "" {
		return "", fmt.Errorf("empty token in response")
	}
	return lr.Token, nil
}

func createDevice(client *http.Client, apiURL, token, deviceID, name string) error {
	body := map[string]string{"device_id": deviceID, "name": name, "type": "sensor"}
	reqBody, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", apiURL+"/api/v1/devices", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusCreated {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
}

func postJSON(client *http.Client, url string, body interface{}) (*http.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return client.Post(url, "application/json", bytes.NewReader(b))
}

func isDuplicate(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "already exists") || strings.Contains(msg, "unique")
}

// ── MQTT Client Setup ────────────────────────────────────────────────────

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
			opts.SetClientID("e2etest-" + deviceID)
			opts.SetCleanSession(true)
			opts.SetConnectTimeout(5 * time.Second)
			opts.SetAutoReconnect(false)
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

// ── Phase 2: Execute ─────────────────────────────────────────────────────

func executeLoadTest(clients []deviceClient, cfg Config) ([]sentMessage, e2eResult) {
	var (
		mu           sync.Mutex
		messages     []sentMessage
		totalSent    atomic.Int64
		totalFailed  atomic.Int64
		brokerAckLat []time.Duration
		seqCounter   atomic.Int64
	)

	interval := time.Duration(float64(cfg.BatchSize) / float64(cfg.TargetRate) * float64(time.Second))
	totalBatches := int(float64(cfg.TargetRate)*cfg.Duration.Seconds()) / cfg.BatchSize

	stop := make(chan struct{})
	batchCount := atomic.Int64{}
	startTime := time.Now()

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		sensorTypes := []string{"temperature", "humidity", "soil_moisture", "light_intensity"}

		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				if int(batchCount.Load()) >= totalBatches {
					return
				}
				batchCount.Add(1)

				for i := 0; i < cfg.BatchSize; i++ {
					idx := rand.Intn(len(clients))
					dc := clients[idx]
					seqID := seqCounter.Add(1)
					sensorType := sensorTypes[rand.Intn(len(sensorTypes))]

					// Build payload with tracking metadata
					now := time.Now()
					payload := telemetryPayload{
						SeqID:     seqID,
						Timestamp: now.UTC().Format(time.RFC3339),
						Readings:  []reading{{Sensor: sensorType, Value: randomValue(sensorType)}},
					}
					payload.Metadata.DeviceID = dc.deviceID
					payload.Metadata.FirmwareVer = "1.2.3"

					payloadBytes, _ := json.Marshal(payload)
					topic := "device/" + dc.deviceID + "/telemetry"

					// Publish with QoS 1 and measure broker ACK
					pubStart := time.Now()
					token := dc.client.Publish(topic, 1, false, payloadBytes)
					token.Wait()
					pubEnd := time.Now()

					msg := sentMessage{
						SeqID:          seqID,
						DeviceID:       dc.deviceID,
						SensorType:     sensorType,
						SentAt:         pubStart,
						PayloadAt:      now,
						BrokerAckAt:    pubEnd,
						BrokerAckDelta: pubEnd.Sub(pubStart),
					}

					if token.Error() != nil {
						totalFailed.Add(1)
					} else {
						totalSent.Add(1)
						mu.Lock()
						messages = append(messages, msg)
						brokerAckLat = append(brokerAckLat, msg.BrokerAckDelta)
						mu.Unlock()
					}
				}

				// Progress
				sent := totalSent.Load()
				if sent > 0 && sent%int64(cfg.BatchSize*10) == 0 {
					elapsed := time.Since(startTime)
					rate := float64(sent) / elapsed.Seconds()
					fmt.Printf("\r  %d msgs sent, %.0f msg/s", sent, rate)
				}
			}
		}
	}()

	time.Sleep(cfg.Duration + 2*time.Second)
	close(stop)
	wg.Wait()

	fmt.Println()

	// Compute broker ACK stats
	result := e2eResult{
		TotalSent:   totalSent.Load(),
		TotalFailed: totalFailed.Load(),
		ActualRate:  float64(totalSent.Load()) / time.Since(startTime).Seconds(),
	}

	if len(brokerAckLat) > 0 {
		sort.Slice(brokerAckLat, func(i, j int) bool { return brokerAckLat[i] < brokerAckLat[j] })
		n := len(brokerAckLat)
		result.BrokerAckMin = brokerAckLat[0]
		result.BrokerAckMax = brokerAckLat[n-1]
		result.BrokerAckP50 = brokerAckLat[n*50/100]
		result.BrokerAckP90 = brokerAckLat[n*90/100]
		result.BrokerAckP95 = brokerAckLat[n*95/100]
		result.BrokerAckP99 = brokerAckLat[int(math.Min(float64(n*99/100), float64(n-1)))]

		var sum time.Duration
		for _, l := range brokerAckLat {
			sum += l
		}
		result.BrokerAckAvg = sum / time.Duration(n)
	}

	return messages, result
}

func randomValue(sensorType string) float64 {
	switch sensorType {
	case "temperature":
		return math.Round((15+rand.Float64()*25)*100) / 100
	case "humidity":
		return math.Round((30+rand.Float64()*50)*100) / 100
	case "soil_moisture":
		return math.Round((10+rand.Float64()*80)*100) / 100
	case "light_intensity":
		return math.Round((1000+rand.Float64()*9000)*100) / 100
	default:
		return math.Round(rand.Float64()*100*100) / 100
	}
}

// ── Phase 3: Verify ──────────────────────────────────────────────────────

type storedRecord struct {
	DeviceID   string
	SensorType string
	Timestamp  time.Time
	ReceivedAt time.Time
}

func verifyAgainstInfluxDB(messages []sentMessage, cfg Config, testStart, testEnd time.Time) e2eResult {
	// Connect to InfluxDB
	client := influxdb2.NewClient(cfg.InfluxURL, cfg.InfluxToken)
	defer client.Close()

	queryAPI := client.QueryAPI(cfg.InfluxOrg)

	// Query all records written during the test window (with 30s buffer for flush)
	rangeStart := testStart.Format(time.RFC3339)
	rangeEnd := testEnd.Add(30 * time.Second).Format(time.RFC3339)

	flux := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: %s, stop: %s)
			|> filter(fn: (r) => r._measurement == "sensor_data")
			|> filter(fn: (r) => r._field == "value" or r._field == "received_at")
			|> pivot(rowKey: ["_time", "device_id", "sensor_type"],
			         columnKey: ["_field"], valueColumn: "_value")
			|> sort(columns: ["_time"], desc: false)
	`, cfg.InfluxBucket, rangeStart, rangeEnd)

	result, err := queryAPI.Query(nil, flux)
	if err != nil {
		fmt.Fprintf(os.Stderr, "  WARN: InfluxDB query failed: %v\n", err)
		return e2eResult{}
	}

	// Build lookup: (deviceID, sensorType, timestamp) → stored record
	type lookupKey struct {
		DeviceID   string
		SensorType string
		Timestamp  time.Time
	}
	storedMap := make(map[lookupKey]storedRecord)
	var storedCount int64

	for result.Next() {
		record := result.Record()
		deviceID, _ := record.ValueByKey("device_id").(string)
		sensorType, _ := record.ValueByKey("sensor_type").(string)

		rec := storedRecord{
			DeviceID:   deviceID,
			SensorType: sensorType,
			Timestamp:  record.Time(),
		}

		// Parse received_at from the pivoted field
		if ra := record.ValueByKey("received_at"); ra != nil {
			switch v := ra.(type) {
			case int64:
				rec.ReceivedAt = time.Unix(0, v)
			case float64:
				rec.ReceivedAt = time.Unix(0, int64(v))
			}
		}

		key := lookupKey{
			DeviceID:   deviceID,
			SensorType: sensorType,
			Timestamp:  record.Time(),
		}
		storedMap[key] = rec
		storedCount++
	}
	if result.Err() != nil {
		fmt.Fprintf(os.Stderr, "  WARN: InfluxDB query iteration error: %v\n", result.Err())
	}

	fmt.Printf("  Messages sent:     %d\n", len(messages))
	fmt.Printf("  Records in InfluxDB: %d\n", storedCount)

	// Match sent → stored and compute E2E latency
	var e2eLatencies []time.Duration
	matched := 0

	for _, msg := range messages {
		// Match by deviceID + sensorType + timestamp (rounded to second for tolerance)
		roundedTS := msg.PayloadAt.Truncate(time.Second)
		key := lookupKey{
			DeviceID:   msg.DeviceID,
			SensorType: msg.SensorType,
			Timestamp:  roundedTS,
		}

		if rec, ok := storedMap[key]; ok && !rec.ReceivedAt.IsZero() {
			latency := rec.ReceivedAt.Sub(msg.SentAt)
			if latency > 0 {
				e2eLatencies = append(e2eLatencies, latency)
				matched++
			}
		}
	}

	// Compute results
	var res e2eResult
	res.TotalStored = int64(matched)

	if len(messages) > 0 {
		res.DataLossPct = float64(len(messages)-matched) / float64(len(messages)) * 100
	}

	testDuration := messages[len(messages)-1].SentAt.Sub(messages[0].SentAt)
	if testDuration > 0 {
		res.ProcessedRate = float64(matched) / testDuration.Seconds()
	}

	if len(e2eLatencies) > 0 {
		sort.Slice(e2eLatencies, func(i, j int) bool { return e2eLatencies[i] < e2eLatencies[j] })
		n := len(e2eLatencies)
		res.E2EMin = e2eLatencies[0]
		res.E2EMax = e2eLatencies[n-1]
		res.E2ELatencyP50 = e2eLatencies[n*50/100]
		res.E2ELatencyP90 = e2eLatencies[n*90/100]
		res.E2ELatencyP95 = e2eLatencies[n*95/100]
		res.E2ELatencyP99 = e2eLatencies[int(math.Min(float64(n*99/100), float64(n-1)))]

		var sum time.Duration
		for _, l := range e2eLatencies {
			sum += l
		}
		res.E2EAvg = sum / time.Duration(n)
	}

	fmt.Printf("  Matched (with E2E): %d\n", matched)
	fmt.Printf("  Data loss:          %.2f%%\n", res.DataLossPct)

	return res
}

// ── Reporting ────────────────────────────────────────────────────────────

func printConfig(cfg Config) {
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("  AGRISENSE E2E MQTT LOAD TEST")
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Printf("  Broker:       %s\n", cfg.Broker)
	fmt.Printf("  API:          %s\n", cfg.API)
	fmt.Printf("  Devices:      %d\n", cfg.NumDevices)
	fmt.Printf("  Target rate:  %d msg/s\n", cfg.TargetRate)
	fmt.Printf("  Duration:     %s\n", cfg.Duration)
	fmt.Printf("  Batch size:   %d\n", cfg.BatchSize)
	fmt.Printf("  InfluxDB:     %s (bucket: %s)\n", cfg.InfluxURL, cfg.InfluxBucket)
}

func printReport(r e2eResult) {
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("  RESULTS")
	fmt.Println("═══════════════════════════════════════════════════════════")

	fmt.Printf("\n  Duration:        %s\n", r.Duration.Round(time.Millisecond))
	fmt.Printf("  Devices:         %d\n", r.DeviceCount)
	fmt.Printf("  Target rate:     %d msg/s\n", r.TargetRate)

	fmt.Println("\n  Throughput:")
	fmt.Printf("    Sent:          %d\n", r.TotalSent)
	fmt.Printf("    Stored:        %d\n", r.TotalStored)
	fmt.Printf("    Failed:        %d\n", r.TotalFailed)
	fmt.Printf("    Send rate:     %.0f msg/s\n", r.ActualRate)
	fmt.Printf("    Processed:     %.0f msg/s\n", r.ProcessedRate)
	lossStatus := "✅"
	if r.DataLossPct >= 1.0 {
		lossStatus = "❌"
	}
	fmt.Printf("    Data loss:     %.2f%% %s\n", r.DataLossPct, lossStatus)

	fmt.Println("\n  Broker ACK Latency (device → broker):")
	fmt.Printf("    Min:   %s\n", r.BrokerAckMin)
	fmt.Printf("    Avg:   %s\n", r.BrokerAckAvg)
	fmt.Printf("    P50:   %s\n", r.BrokerAckP50)
	fmt.Printf("    P90:   %s\n", r.BrokerAckP90)
	fmt.Printf("    P95:   %s\n", r.BrokerAckP95)
	fmt.Printf("    P99:   %s\n", r.BrokerAckP99)
	fmt.Printf("    Max:   %s\n", r.BrokerAckMax)

	fmt.Println("\n  E2E Latency (device → broker → backend → InfluxDB):")
	fmt.Printf("    Min:   %s\n", r.E2EMin)
	fmt.Printf("    Avg:   %s\n", r.E2EAvg)
	fmt.Printf("    P50:   %s\n", r.E2ELatencyP50)
	fmt.Printf("    P90:   %s\n", r.E2ELatencyP90)
	fmt.Printf("    P95:   %s\n", r.E2ELatencyP95)
	fmt.Printf("    P99:   %s\n", r.E2ELatencyP99)
	fmt.Printf("    Max:   %s\n", r.E2EMax)

	// Pipeline breakdown estimate
	if r.E2EAvg > r.BrokerAckAvg {
		backendAvg := r.E2EAvg - r.BrokerAckAvg
		fmt.Println("\n  Pipeline Breakdown (estimated averages):")
		fmt.Printf("    Broker ACK:       %s\n", r.BrokerAckAvg)
		fmt.Printf("    Backend process:  %s (includes broker→backend + parse + InfluxDB write)\n", backendAvg)
	}

	fmt.Println("\n  Assessment:")
	if r.ActualRate >= float64(r.TargetRate) {
		fmt.Printf("    Throughput:  ✅ PASS (%.0f >= %d target)\n", r.ActualRate, r.TargetRate)
	} else {
		fmt.Printf("    Throughput:  ❌ FAIL (%.0f < %d target)\n", r.ActualRate, r.TargetRate)
	}
	if r.DataLossPct < 1.0 {
		fmt.Printf("    Data loss:   ✅ PASS (%.2f%% < 1%%)\n", r.DataLossPct)
	} else {
		fmt.Printf("    Data loss:   ❌ FAIL (%.2f%% >= 1%%)\n", r.DataLossPct)
	}
}

func saveReport(r e2eResult) {
	dir := "results"
	os.MkdirAll(dir, 0o755)

	filename := filepath.Join(dir, fmt.Sprintf("e2e-load-%s.txt", time.Now().Format("20060102-150405")))
	f, err := os.Create(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "WARN: could not save report: %v\n", err)
		return
	}
	defer f.Close()

	fmt.Fprintf(f, "AgriSense E2E MQTT Load Test Report\n")
	fmt.Fprintf(f, "Generated: %s\n\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(f, "Duration:        %s\n", r.Duration.Round(time.Millisecond))
	fmt.Fprintf(f, "Devices:         %d\n", r.DeviceCount)
	fmt.Fprintf(f, "Target rate:     %d msg/s\n\n", r.TargetRate)
	fmt.Fprintf(f, "Throughput:\n")
	fmt.Fprintf(f, "  Sent:          %d\n", r.TotalSent)
	fmt.Fprintf(f, "  Stored:        %d\n", r.TotalStored)
	fmt.Fprintf(f, "  Failed:        %d\n", r.TotalFailed)
	fmt.Fprintf(f, "  Send rate:     %.0f msg/s\n", r.ActualRate)
	fmt.Fprintf(f, "  Processed:     %.0f msg/s\n", r.ProcessedRate)
	fmt.Fprintf(f, "  Data loss:     %.2f%%\n\n", r.DataLossPct)
	fmt.Fprintf(f, "Broker ACK Latency:\n")
	fmt.Fprintf(f, "  Min:  %s\n", r.BrokerAckMin)
	fmt.Fprintf(f, "  Avg:  %s\n", r.BrokerAckAvg)
	fmt.Fprintf(f, "  P50:  %s\n", r.BrokerAckP50)
	fmt.Fprintf(f, "  P90:  %s\n", r.BrokerAckP90)
	fmt.Fprintf(f, "  P95:  %s\n", r.BrokerAckP95)
	fmt.Fprintf(f, "  P99:  %s\n", r.BrokerAckP99)
	fmt.Fprintf(f, "  Max:  %s\n\n", r.BrokerAckMax)
	fmt.Fprintf(f, "E2E Latency:\n")
	fmt.Fprintf(f, "  Min:  %s\n", r.E2EMin)
	fmt.Fprintf(f, "  Avg:  %s\n", r.E2EAvg)
	fmt.Fprintf(f, "  P50:  %s\n", r.E2ELatencyP50)
	fmt.Fprintf(f, "  P90:  %s\n", r.E2ELatencyP90)
	fmt.Fprintf(f, "  P95:  %s\n", r.E2ELatencyP95)
	fmt.Fprintf(f, "  P99:  %s\n", r.E2ELatencyP99)
	fmt.Fprintf(f, "  Max:  %s\n", r.E2EMax)

	fmt.Printf("\nReport saved to: %s\n", filename)
}
