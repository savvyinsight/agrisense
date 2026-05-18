package main

import (
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"

	"github.com/savvyinsight/agrisense/internal/config"
)

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("Usage: go run ./cmd/migrate <up|down|drop|force VERSION|version>")
	}

	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		cfg.DBUser, cfg.DBPassword, cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBSSLMode,
	)

	m, err := migrate.New("file://migrations", connStr)
	if err != nil {
		log.Fatalf("Failed to create migrator: %v", err)
	}

	cmd := os.Args[1]
	switch cmd {
	case "up":
		if err := m.Up(); err != nil && err != migrate.ErrNoChange {
			log.Fatalf("Migrate up failed: %v", err)
		}
		fmt.Println("Migrations applied successfully")

	case "down":
		steps := 1
		if len(os.Args) > 2 {
			fmt.Sscanf(os.Args[2], "%d", &steps)
		}
		if err := m.Steps(-steps); err != nil {
			log.Fatalf("Migrate down failed: %v", err)
		}
		fmt.Printf("Rolled back %d migration(s)\n", steps)

	case "drop":
		if err := m.Drop(); err != nil {
			log.Fatalf("Migrate drop failed: %v", err)
		}
		fmt.Println("All tables dropped")

	case "force":
		if len(os.Args) < 3 {
			log.Fatalf("Usage: go run ./cmd/migrate force VERSION")
		}
		version := 0
		fmt.Sscanf(os.Args[2], "%d", &version)
		if err := m.Force(version); err != nil {
			log.Fatalf("Migrate force failed: %v", err)
		}
		fmt.Printf("Forced version to %d\n", version)

	case "version":
		version, dirty, err := m.Version()
		if err != nil && err != migrate.ErrNilVersion {
			log.Fatalf("Failed to get version: %v", err)
		}
		if err == migrate.ErrNilVersion {
			fmt.Println("No migrations have been applied")
		} else {
			fmt.Printf("Current version: %d (dirty: %v)\n", version, dirty)
		}

	default:
		log.Fatalf("Unknown command: %s (use: up, down, drop, force, version)", cmd)
	}
}
