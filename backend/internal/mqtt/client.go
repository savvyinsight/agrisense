package mqtt

import (
	"fmt"
	"log"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type Client struct {
	client   mqtt.Client
	handlers *Handlers
}

type Handlers struct {
	TelemetryHandler func(deviceID string, payload []byte)
	HeartbeatHandler func(deviceID string, payload []byte)
	ResponseHandler  func(deviceID string, payload []byte)
}

type Config struct {
	Broker   string
	ClientID string
	Username string
	Password string
}

func NewClient(cfg Config, handlers *Handlers) (*Client, error) {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(cfg.Broker)
	opts.SetClientID(cfg.ClientID)
	opts.SetUsername(cfg.Username)
	opts.SetPassword(cfg.Password)
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(10 * time.Second)
	opts.SetAutoReconnect(true)
	opts.SetMaxReconnectInterval(10 * time.Second)
	opts.SetConnectionLostHandler(connectionLostHandler)
	opts.SetOnConnectHandler(connectHandler)

	// Add this - wait for connection before returning
	opts.SetConnectTimeout(30 * time.Second) // Add timeout

	client := mqtt.NewClient(opts)

	if token := client.Connect(); token.Wait() && token.Error() != nil {
		return nil, fmt.Errorf("failed to connect to MQTT broker: %w", token.Error())
	}

	//Wait a bit for connection to stabilize
	time.Sleep(1 * time.Second) // Add small delay

	// Verify connection before proceeding
	if !client.IsConnected() {
		return nil, fmt.Errorf("MQTT client not connected after connect")
	}

	return &Client{
		client:   client,
		handlers: handlers,
	}, nil
}

func connectionLostHandler(client mqtt.Client, err error) {
	log.Printf("MQTT connection lost: %v", err)
}

func connectHandler(client mqtt.Client) {
	log.Println("MQTT connected to broker")
}

func (c *Client) Subscribe() error {
	// Ensure we're connected
	// Subscribe() can be called anytime and will ensure connection first.
	if !c.client.IsConnected() {
		token := c.client.Connect()
		if token.Wait() && token.Error() != nil {
			return token.Error()
		}
	}

	handlers := map[string]mqtt.MessageHandler{
		TelemetryTopic: c.handleTelemetry,
		HeartbeatTopic: c.handleHeartbeat,
		ResponseTopic:  c.handleResponse,
	}

	for topic, handler := range handlers {
		token := c.client.Subscribe(topic, 1, handler)
		token.Wait()
		if token.Error() != nil {
			return fmt.Errorf("failed to subscribe to %s: %w", topic, token.Error())
		}
		log.Printf("Subscribed to topic: %s", topic)
	}

	return nil
}

func (c *Client) handleTelemetry(_ mqtt.Client, msg mqtt.Message) {
	deviceID := ExtractDeviceIDFromTopic(msg.Topic())
	if c.handlers.TelemetryHandler != nil {
		c.handlers.TelemetryHandler(deviceID, msg.Payload())
	}
}

func (c *Client) handleHeartbeat(_ mqtt.Client, msg mqtt.Message) {
	deviceID := ExtractDeviceIDFromTopic(msg.Topic())
	if c.handlers.HeartbeatHandler != nil {
		c.handlers.HeartbeatHandler(deviceID, msg.Payload())
	}
}

func (c *Client) handleResponse(_ mqtt.Client, msg mqtt.Message) {
	deviceID := ExtractDeviceIDFromTopic(msg.Topic())
	if c.handlers.ResponseHandler != nil {
		c.handlers.ResponseHandler(deviceID, msg.Payload())
	}
}

func (c *Client) PublishCommand(deviceID string, payload []byte) error {
	topic := GetCommandTopic(deviceID)
	token := c.client.Publish(topic, 1, false, payload)
	token.Wait()
	return token.Error()
}

func (c *Client) PublishConfig(deviceID string, payload []byte) error {
	topic := GetConfigTopic(deviceID)
	token := c.client.Publish(topic, 1, false, payload)
	token.Wait()
	return token.Error()
}

func (c *Client) Disconnect() {
	if c.client != nil && c.client.IsConnected() {
		c.client.Disconnect(250)
	}
}
