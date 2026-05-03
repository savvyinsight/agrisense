package main

import (
	"log"

	"github.com/savvyinsight/agrisenseiot/internal/config"
	"github.com/savvyinsight/agrisenseiot/internal/repository/postgres"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := postgres.NewConnection(postgres.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		DBName:   cfg.DBName,
		SSLMode:  cfg.DBSSLMode,
	})
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	log.Println("Successfully connected to database!")

	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM sensor_types").Scan(&count)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("Found %d sensor types", count)
}
