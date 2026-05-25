package notification

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/savvyinsight/agrisense/internal/alert"
)

type WebhookConfig struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers,omitempty"`
	Method  string            `json:"method,omitempty"`
}

type Dispatcher struct {
	channelRepo ChannelRepository
	httpClient  *http.Client
}

func NewDispatcher(channelRepo ChannelRepository) *Dispatcher {
	return &Dispatcher{
		channelRepo: channelRepo,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type NotificationPayload struct {
	AlertID     int                    `json:"alert_id"`
	RuleName    string                 `json:"rule_name"`
	DeviceID    string                 `json:"device_id"`
	Severity    string                 `json:"severity"`
	Message     string                 `json:"message"`
	Value       float64                `json:"value"`
	TriggeredAt time.Time              `json:"triggered_at"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

func (d *Dispatcher) Dispatch(a *alert.Alert, channelIDs []int) {
	payload := NotificationPayload{
		AlertID:     a.ID,
		RuleName:    a.RuleName,
		DeviceID:    a.DeviceIDStr,
		Severity:    string(a.Severity),
		Message:     a.Message,
		Value:       a.SensorValue,
		TriggeredAt: a.TriggeredAt,
		Metadata:    a.Metadata,
	}

	for _, channelID := range channelIDs {
		ch, err := d.channelRepo.GetByID(channelID)
		if err != nil {
			log.Printf("Failed to get notification channel %d: %v", channelID, err)
			continue
		}
		if !ch.Enabled {
			continue
		}

		switch ch.Type {
		case "webhook":
			d.sendWebhook(ch, payload)
		case "email":
			log.Printf("[STUB] Email notification for alert %d via channel %d (SMTP not configured)", a.ID, ch.ID)
		case "sms":
			log.Printf("[STUB] SMS notification for alert %d via channel %d (SMS provider not configured)", a.ID, ch.ID)
		default:
			log.Printf("Unknown notification channel type: %s", ch.Type)
		}
	}
}

func (d *Dispatcher) sendWebhook(ch *Channel, payload NotificationPayload) {
	var config WebhookConfig
	if err := json.Unmarshal(ch.Config, &config); err != nil {
		log.Printf("Failed to parse webhook config for channel %d: %v", ch.ID, err)
		return
	}

	if config.URL == "" {
		log.Printf("Webhook URL is empty for channel %d", ch.ID)
		return
	}

	method := config.Method
	if method == "" {
		method = "POST"
	}

	body, err := json.Marshal(map[string]interface{}{
		"alert":     payload,
		"channel_id": ch.ID,
		"timestamp": time.Now(),
	})
	if err != nil {
		log.Printf("Failed to marshal webhook payload: %v", err)
		return
	}

	req, err := http.NewRequest(method, config.URL, bytes.NewReader(body))
	if err != nil {
		log.Printf("Failed to create webhook request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AgriSense-Alert/1.0")
	for k, v := range config.Headers {
		req.Header.Set(k, v)
	}

	resp, err := d.httpClient.Do(req)
	if err != nil {
		log.Printf("Webhook delivery failed for channel %d: %v", ch.ID, err)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("Webhook delivered for alert %d via channel %d (status: %d)",
			payload.AlertID, ch.ID, resp.StatusCode)
	} else {
		log.Printf("Webhook returned non-2xx for alert %d via channel %d: %d",
			payload.AlertID, ch.ID, resp.StatusCode)
	}
}
