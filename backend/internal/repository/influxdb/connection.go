package influxdb

import (
	"context"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
)

type Config struct {
	URL    string
	Token  string
	Org    string
	Bucket string
}

type Repository struct {
	client influxdb2.Client
	org    string
	bucket string
}

func NewRepository(cfg Config) (*Repository, error) {
	client := influxdb2.NewClient(cfg.URL, cfg.Token)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	health, err := client.Health(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to InfluxDB: %w", err)
	}

	if health.Status != "pass" {
		return nil, fmt.Errorf("InfluxDB health check failed: %s", *health.Message)
	}

	return &Repository{
		client: client,
		org:    cfg.Org,
		bucket: cfg.Bucket,
	}, nil
}

func (r *Repository) Close() {
	if r.client != nil {
		r.client.Close()
	}
}
