package mqtt

import (
	"strings"
)

// Topic patterns
const (
	// Device → Platform
	TelemetryTopic = "device/+/telemetry"
	HeartbeatTopic = "device/+/heartbeat"
	ResponseTopic  = "device/+/response"

	// Platform → Device
	CommandTopic = "device/%s/commands"
	ConfigTopic  = "device/%s/config"
)

// GetCommandTopic returns the command topic for a specific device
func GetCommandTopic(deviceID string) string {
	return "device/" + deviceID + "/commands"
}

// GetConfigTopic returns the config topic for a specific device
func GetConfigTopic(deviceID string) string {
	return "device/" + deviceID + "/config"
}

// ExtractDeviceIDFromTopic extracts device ID from any subscription topic
func ExtractDeviceIDFromTopic(topic string) string {
	// Topic format: device/{device_id}/{suffix}
	// Split by "/" and return the second part
	parts := strings.Split(topic, "/")
	if len(parts) >= 3 {
		return parts[1] // device_id is the second part
	}
	return ""
}
