package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	return Config{
		Host:     getEnvOrDefault("DB_HOST", "localhost"),
		Port:     getEnvOrDefault("DB_PORT", "5432"),
		User:     getEnvOrDefault("DB_USER", "postgres"),
		Password: getEnvOrDefault("DB_PASSWORD", "postgres"),
		DBName:   getEnvOrDefault("DB_NAME", "agrisense"),
		SSLMode:  getEnvOrDefault("DB_SSL_MODE", "disable"),
	}
}

func main() {
	cfg := loadConfig()
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer func() { _ = db.Close() }()

	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to database")

	// Step 1: Create or get account + user
	email := "test@agrisense.io"
	accountName := "Test Farm"
	accountID, userID := ensureAccountAndUser(db, accountName, email, "test123", "account_owner")
	log.Printf("Account ID=%d, User ID=%d", accountID, userID)

	// Grant account_owner permission in user_permissions table
	ensurePermission(db, userID, accountID, "account_owner")

	// Step 2: Create 2 fields
	fields := []struct {
		name     string
		lat, lng float64
		crop     string
		area     float64
	}{
		{"North Field", 40.7128, -74.0060, "Corn", 12.5},
		{"South Field", 40.7000, -73.9900, "Wheat", 8.3},
	}

	knownDeviceIDs := []string{}
	fieldIDs := make(map[string]int)
	for _, f := range fields {
		health := "healthy"
		if f.name == "South Field" {
			health = "warning"
		}
		fieldID := ensureField(db, f.name, f.lat, f.lng, f.crop, f.area, health, accountID, userID)
		fieldIDs[f.name] = fieldID
		log.Printf("Field '%s' ID=%d health=%s", f.name, fieldID, health)

		// Step 3: Create 2 sensors per field
		sensorIDs := []string{
			fmt.Sprintf("SEN-%s-%s", fieldAbbrev(f.name), "TEMP"),
			fmt.Sprintf("SEN-%s-%s", fieldAbbrev(f.name), "SOIL"),
		}
		for _, sid := range sensorIDs {
			devID := ensureDevice(db, sid, fmt.Sprintf("%s Sensor", sid), "sensor", &fieldID, accountID, userID)
			knownDeviceIDs = append(knownDeviceIDs, sid)
			log.Printf("  Device '%s' ID=%d", sid, devID)
		}

		// Step 4: Create 1 controller per field
		ctrlID := fmt.Sprintf("CTRL-%s", fieldAbbrev(f.name))
		ctrlDevID := ensureDevice(db, ctrlID, fmt.Sprintf("%s Controller", ctrlID), "controller", &fieldID, accountID, userID)
		knownDeviceIDs = append(knownDeviceIDs, ctrlID)
		log.Printf("  Controller '%s' ID=%d", ctrlID, ctrlDevID)

		// Step 5: Create irrigation zone for the controller
		zoneID := ensureZone(db, fmt.Sprintf("%s Zone", f.name), fieldID, ctrlDevID, accountID, userID)
		log.Printf("  Zone ID=%d", zoneID)
	}

	// Step 6: Create example alert rules
	northFieldID := fieldIDs["North Field"]
	southFieldID := fieldIDs["South Field"]
	_ = northFieldID

	// Critical alert: South Field soil moisture critically low
	ensureAlertRule(db, "South Field - Critical Moisture", southFieldID, 3, "<", 20.0, nil, 0, "critical", userID)
	// Warning alert: South Field temperature high
	ensureAlertRule(db, "South Field - High Temp Warning", southFieldID, 1, ">", 35.0, nil, 300, "warning", userID)
	// Info alert: South Field humidity out of range
	ensureAlertRule(db, "South Field - Humidity Range", southFieldID, 2, "between", 30.0, float64Ptr(90.0), 0, "info", userID)

	fmt.Println()
	fmt.Println("=== SEED COMPLETE ===")
	fmt.Println("Device IDs for simulator:")
	for _, id := range knownDeviceIDs {
		fmt.Printf("  %s\n", id)
	}
	fmt.Println()
	fmt.Println("Run: cd backend && make simulate")
}

func ensurePermission(db *sql.DB, userID, accountID int, role string) {
	var existing int
	err := db.QueryRow(`SELECT id FROM user_permissions WHERE user_id = $1 AND account_id = $2 AND farm_id IS NULL AND role = $3`, userID, accountID, role).Scan(&existing)
	if err == nil {
		log.Printf("Permission '%s' already exists for user %d", role, userID)
		return
	}

	_, err = db.Exec(`INSERT INTO user_permissions (user_id, account_id, farm_id, role, granted_by_id, granted_at) VALUES ($1, $2, NULL, $3, $1, NOW())`, userID, accountID, role)
	if err != nil {
		log.Fatalf("Failed to create permission: %v", err)
	}
	log.Printf("Granted '%s' permission to user %d on account %d", role, userID, accountID)
}

func ensureAlertRule(db *sql.DB, name string, fieldID int, sensorTypeID int, condition string, thresholdValue float64, thresholdMax *float64, durationSeconds int, severity string, userID int) {
	var existing int
	err := db.QueryRow(`SELECT id FROM alert_rules WHERE name = $1 AND user_id = $2`, name, userID).Scan(&existing)
	if err == nil {
		return
	}

	var maxVal *float64
	if thresholdMax != nil {
		maxVal = thresholdMax
	}

	_, err = db.Exec(`INSERT INTO alert_rules (name, field_id, sensor_type_id, condition, threshold_value, threshold_max, duration_seconds, severity, enabled, user_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW(), NOW())`,
		name, fieldID, sensorTypeID, condition, thresholdValue, maxVal, durationSeconds, severity, userID)
	if err != nil {
		log.Printf("Warning: Failed to create alert rule '%s': %v", name, err)
	} else {
		log.Printf("Created alert rule '%s'", name)
	}
}

func float64Ptr(v float64) *float64 {
	return &v
}

func fieldAbbrev(name string) string {
	switch name {
	case "North Field":
		return "NTH"
	case "South Field":
		return "STH"
	default:
		return name[:3]
	}
}

func ensureAccountAndUser(db *sql.DB, accountName, email, password, role string) (accountID, userID int) {
	// Check if user exists
	err := db.QueryRow(`SELECT u.account_id, u.id FROM users u WHERE u.email = $1`, email).Scan(&accountID, &userID)
	if err == nil {
		log.Printf("User %s already exists (account=%d, user=%d)", email, accountID, userID)
		return
	}

	// Create user first (without account_id to break circular dependency)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Failed to hash password: %v", err)
	}

	err = db.QueryRow(`INSERT INTO users (username, email, password_hash, role, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
		email, email, string(hash), role).Scan(&userID)
	if err != nil {
		log.Fatalf("Failed to create user: %v", err)
	}
	log.Printf("Created user '%s' ID=%d", email, userID)

	// Create account with owner_id = user.id
	err = db.QueryRow(`INSERT INTO accounts (name, subscription_tier, owner_id, max_users, max_devices, created_at, updated_at) VALUES ($1, 'professional', $2, 10, 50, NOW(), NOW()) RETURNING id`,
		accountName, userID).Scan(&accountID)
	if err != nil {
		log.Fatalf("Failed to create account: %v", err)
	}
	log.Printf("Created account '%s' ID=%d (owner=%d)", accountName, accountID, userID)

	// Link user to account
	_, err = db.Exec(`UPDATE users SET account_id = $1 WHERE id = $2`, accountID, userID)
	if err != nil {
		log.Fatalf("Failed to link user to account: %v", err)
	}
	log.Printf("Linked user %d → account %d", userID, accountID)

	return
}

func ensureField(db *sql.DB, name string, lat, lng float64, crop string, area float64, health string, accountID, userID int) int {
	var id int
	err := db.QueryRow(`SELECT id FROM fields WHERE name = $1 AND user_id = $2`, name, userID).Scan(&id)
	if err == nil {
		return id
	}

	geometry := fmt.Sprintf(`{"type":"Polygon","coordinates":[[[%f,%f],[%f,%f],[%f,%f],[%f,%f],[%f,%f]]]}`,
		lng-0.005, lat-0.003,
		lng+0.005, lat-0.003,
		lng+0.005, lat+0.003,
		lng-0.005, lat+0.003,
		lng-0.005, lat-0.003)

	err = db.QueryRow(`INSERT INTO fields (name, crop, area_hectares, health, soil_moisture, temperature, humidity, user_id, account_id, latitude, longitude, geometry, created_at, updated_at)
		VALUES ($1, $2, $3, $4, 55.0, 24.0, 65.0, $5, $6, $7, $8, $9::jsonb, NOW(), NOW()) RETURNING id`,
		name, crop, area, health, userID, accountID, lat, lng, geometry).Scan(&id)
	if err != nil {
		log.Fatalf("Failed to create field '%s': %v", name, err)
	}
	return id
}

func ensureDevice(db *sql.DB, deviceID, name, devType string, fieldID *int, accountID, userID int) int {
	var id int
	err := db.QueryRow(`SELECT id FROM devices WHERE device_id = $1`, deviceID).Scan(&id)
	if err == nil {
		return id
	}

	err = db.QueryRow(`INSERT INTO devices (device_id, name, type, status, field_id, user_id, account_id, firmware_version, config, created_at, updated_at)
		VALUES ($1, $2, $3, 'offline', $4, $5, $6, 'v1.0.0', '{}'::jsonb, NOW(), NOW()) RETURNING id`,
		deviceID, name, devType, fieldID, userID, accountID).Scan(&id)
	if err != nil {
		log.Fatalf("Failed to create device '%s': %v", deviceID, err)
	}
	return id
}

func ensureZone(db *sql.DB, name string, fieldID, deviceID, accountID, userID int) int {
	var id int
	err := db.QueryRow(`SELECT id FROM irrigation_zones WHERE name = $1 AND field_id = $2`, name, fieldID).Scan(&id)
	if err == nil {
		return id
	}

	now := time.Now()
	err = db.QueryRow(`INSERT INTO irrigation_zones (name, field_id, device_id, moisture, target_moisture, status, runtime_minutes, flow_rate_lpm, user_id, account_id, created_at, updated_at)
		VALUES ($1, $2, $3, 0, 60, 'idle', 0, 50.0, $4, $5, $6, $6) RETURNING id`,
		name, fieldID, deviceID, userID, accountID, now).Scan(&id)
	if err != nil {
		log.Fatalf("Failed to create zone '%s': %v", name, err)
	}
	return id
}
