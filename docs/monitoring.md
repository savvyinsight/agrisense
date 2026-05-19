# Monitoring Setup

This project uses Prometheus for metrics collection and Grafana for visualization.

## Services

- **Prometheus**: Metrics collection and storage (port 9090)
- **Grafana**: Dashboard and visualization (port 3000)

## Metrics Exposed

The API server exposes the following metrics at `/metrics`:

- `http_requests_total`: Total number of HTTP requests
- `http_request_duration_seconds`: HTTP request duration
- `mqtt_messages_processed_total`: Total MQTT messages processed
- `active_devices_total`: Number of currently active devices

## Accessing Monitoring

### Prometheus
- URL: http://localhost:9090
- Default login: none required

### Grafana
- URL: http://localhost:3000
- Default login: admin / admin

### Adding Prometheus as Data Source in Grafana

1. Open Grafana at http://localhost:3000
2. Login with admin/admin
3. Go to Configuration > Data Sources
4. Add Prometheus data source with URL: http://prometheus:9090
5. Save and test the connection

## Docker Compose

Both development and production docker-compose files include Prometheus and Grafana services.

To start monitoring:

```bash
# Development
docker-compose up

# Production
docker-compose -f deployments/docker-compose.prod.yml up
```

## Configuration

Prometheus configuration is in `deployments/prometheus/prometheus.yml`.

It scrapes metrics from:
- API service at `api:8080/metrics`
- Prometheus itself at `prometheus:9090`