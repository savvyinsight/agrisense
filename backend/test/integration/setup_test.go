//go:build integration

package integration

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	tcRedis "github.com/testcontainers/testcontainers-go/modules/redis"
	"github.com/testcontainers/testcontainers-go/wait"
	_ "github.com/lib/pq"
)

var testDB *sql.DB
var testRedis *redis.Client
var testInflux influxdb2.Client
var testInfluxURL string
var testInfluxToken string

func TestMain(m *testing.M) {
	ctx := context.Background()

	// Start PostgreSQL container
	pgContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("postgres:15-alpine"),
		postgres.WithDatabase("testdb"),
		postgres.WithUsername("testuser"),
		postgres.WithPassword("testpass"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		panic(err)
	}

	pgHost, err := pgContainer.Host(ctx)
	if err != nil {
		panic(err)
	}
	pgPort, err := pgContainer.MappedPort(ctx, "5432")
	if err != nil {
		panic(err)
	}

	testDB, err = sql.Open("postgres", fmt.Sprintf("host=%s port=%s user=testuser password=testpass dbname=testdb sslmode=disable", pgHost, pgPort.Port()))
	if err != nil {
		panic(err)
	}
	testDB.SetMaxOpenConns(1)
	if err := testDB.PingContext(ctx); err != nil {
		panic(err)
	}

	// Run all migrations in order
	migrationFiles, err := filepath.Glob("../../deployments/init/postgres/*.sql")
	if err != nil {
		panic(err)
	}
	sort.Strings(migrationFiles)
	for _, f := range migrationFiles {
		migrationSQL, err := os.ReadFile(f)
		if err != nil {
			panic(fmt.Errorf("failed to read migration %s: %w", f, err))
		}
		_, err = testDB.Exec(string(migrationSQL))
		if err != nil {
			// Check if the migration file has an alternate version without FK to farms
			// If the "farms" table doesn't exist, create a stub and retry
			if strings.Contains(err.Error(), `relation "farms" does not exist`) {
				_, _ = testDB.Exec("CREATE TABLE IF NOT EXISTS farms (id SERIAL PRIMARY KEY)")
				_, err = testDB.Exec(string(migrationSQL))
				if err != nil {
					panic(fmt.Errorf("failed to execute migration %s (with farms stub): %w", f, err))
				}
			} else {
				panic(fmt.Errorf("failed to execute migration %s: %w", f, err))
			}
		}
	}

	// Start Redis container
	redisContainer, err := tcRedis.RunContainer(ctx,
		testcontainers.WithImage("redis:7-alpine"),
		testcontainers.WithWaitStrategy(wait.ForLog("Ready to accept connections")),
	)
	if err != nil {
		panic(err)
	}

	redisHost, err := redisContainer.Host(ctx)
	if err != nil {
		panic(err)
	}
	redisPort, err := redisContainer.MappedPort(ctx, "6379")
	if err != nil {
		panic(err)
	}

	testRedis = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", redisHost, redisPort.Port()),
	})

	// Start InfluxDB container
	influxContainer, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: testcontainers.ContainerRequest{
			Image:        "influxdb:2.7-alpine",
			ExposedPorts: []string{"8086/tcp"},
			Env: map[string]string{
				"DOCKER_INFLUXDB_INIT_MODE":        "setup",
				"DOCKER_INFLUXDB_INIT_USERNAME":    "admin",
				"DOCKER_INFLUXDB_INIT_PASSWORD":    "admin123",
				"DOCKER_INFLUXDB_INIT_ORG":         "test-org",
				"DOCKER_INFLUXDB_INIT_BUCKET":      "test-bucket",
				"DOCKER_INFLUXDB_INIT_ADMIN_TOKEN": "test-token",
			},
			WaitingFor: wait.ForHTTP("/health").WithPort("8086/tcp").WithStatusCodeMatcher(func(status int) bool {
				return status == 200
			}).WithStartupTimeout(60 * time.Second),
		},
		Started: true,
	})
	if err != nil {
		panic(err)
	}

	influxHost, err := influxContainer.Host(ctx)
	if err != nil {
		panic(err)
	}
	influxPort, err := influxContainer.MappedPort(ctx, "8086")
	if err != nil {
		panic(err)
	}

	testInflux = influxdb2.NewClient(fmt.Sprintf("http://%s:%s", influxHost, influxPort.Port()), "test-token")
	testInfluxURL = fmt.Sprintf("http://%s:%s", influxHost, influxPort.Port())
	testInfluxToken = "test-token"

	// Run tests
	code := m.Run()

	// Cleanup
	testDB.Close()
	testRedis.Close()
	testInflux.Close()

	pgContainer.Terminate(ctx)
	redisContainer.Terminate(ctx)
	influxContainer.Terminate(ctx)

	os.Exit(code)
}