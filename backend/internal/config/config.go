package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// Server
	Port      string
	Env       string
	JWTSecret string
	JWTExpiry time.Duration

	// PostgreSQL
	DBHost     string
	DBPort     int
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// InfluxDB
	InfluxURL    string
	InfluxToken  string
	InfluxOrg    string
	InfluxBucket string

	// Redis
	RedisHost     string
	RedisPort     int
	RedisPassword string
	RedisDB       int

	// MQTT
	MQTTBroker   string
	MQTTUsername string
	MQTTPassword string
}

func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	config := &Config{
		Port:      getEnv("PORT", "8080"),
		Env:       getEnv("ENV", "development"),
		JWTSecret: getEnv("JWT_SECRET", "your-secret-key"),
		JWTExpiry: time.Hour * 24, // 24 hours default

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnvAsInt("DB_PORT", 5432),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "agrisense"),
		DBSSLMode:  getEnv("DB_SSL_MODE", "disable"),

		InfluxURL:    getEnv("INFLUXDB_URL", "http://localhost:8086"),
		InfluxToken:  getEnv("INFLUXDB_TOKEN", "my-token"),
		InfluxOrg:    getEnv("INFLUXDB_ORG", "my-org"),
		InfluxBucket: getEnv("INFLUXDB_BUCKET", "sensor_data"),

		RedisHost:     getEnv("REDIS_HOST", "localhost"),
		RedisPort:     getEnvAsInt("REDIS_PORT", 6379),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		MQTTBroker:   getEnv("MQTT_BROKER", "tcp://localhost:1883"),
		MQTTUsername: getEnv("MQTT_USERNAME", ""),
		MQTTPassword: getEnv("MQTT_PASSWORD", ""),
	}

	return config, nil
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
