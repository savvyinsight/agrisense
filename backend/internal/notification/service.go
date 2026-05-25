package notification

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Service struct {
	channelRepo ChannelRepository
	routingRepo RoutingRuleRepository
}

func NewService(channelRepo ChannelRepository, routingRepo RoutingRuleRepository) *Service {
	return &Service{
		channelRepo: channelRepo,
		routingRepo: routingRepo,
	}
}

func (s *Service) GetSettings() (*NotificationSettings, error) {
	channels, err := s.channelRepo.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list channels: %w", err)
	}

	rules, err := s.routingRepo.List()
	if err != nil {
		return nil, fmt.Errorf("failed to list routing rules: %w", err)
	}

	return &NotificationSettings{
		Channels:     channels,
		RoutingRules: rules,
	}, nil
}

func (s *Service) CreateChannel(ch *Channel) error {
	if ch.Type == "" {
		return fmt.Errorf("channel type is required")
	}
	if ch.Name == "" {
		return fmt.Errorf("channel name is required")
	}
	if ch.Type != "email" && ch.Type != "sms" && ch.Type != "webhook" {
		return fmt.Errorf("invalid channel type: %s", ch.Type)
	}
	return s.channelRepo.Create(ch)
}

func (s *Service) GetChannel(id int) (*Channel, error) {
	return s.channelRepo.GetByID(id)
}

func (s *Service) UpdateChannel(id int, ch *Channel) error {
	return s.channelRepo.Update(id, ch)
}

func (s *Service) DeleteChannel(id int) error {
	return s.channelRepo.Delete(id)
}

func (s *Service) UpdateRoutingRule(id int, rule *RoutingRule) error {
	return s.routingRepo.Update(id, rule)
}

func (s *Service) TestChannel(id int) error {
	ch, err := s.channelRepo.GetByID(id)
	if err != nil {
		return fmt.Errorf("channel not found: %w", err)
	}

	if !ch.Enabled {
		return fmt.Errorf("channel is disabled")
	}

	if ch.Type == "webhook" {
		var config WebhookConfig
		if err := json.Unmarshal(ch.Config, &config); err != nil {
			return fmt.Errorf("invalid webhook config: %w", err)
		}
		if config.URL == "" {
			return fmt.Errorf("webhook URL is empty")
		}
		testPayload := map[string]interface{}{
			"test":      true,
			"channel":   ch.Name,
			"timestamp": time.Now(),
		}
		body, _ := json.Marshal(testPayload)
		resp, err := http.Post(config.URL, "application/json", bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("webhook test failed: %w", err)
		}
		defer func() { _ = resp.Body.Close() }()
		if resp.StatusCode >= 400 {
			return fmt.Errorf("webhook returned status %d", resp.StatusCode)
		}
	}

	return nil
}
