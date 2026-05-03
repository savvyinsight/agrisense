package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	activeDevices = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_devices_total",
			Help: "Number of currently active devices",
		},
	)

	messagesProcessed = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "mqtt_messages_processed_total",
			Help: "Total number of MQTT messages processed",
		},
	)
)

func init() {
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(activeDevices)
	prometheus.MustRegister(messagesProcessed)
}

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start).Seconds()
		status := c.Writer.Status()

		httpRequestsTotal.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
			http.StatusText(status),
		).Inc()

		httpRequestDuration.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
		).Observe(duration)
	}
}

func RecordMessage() {
	messagesProcessed.Inc()
}

func SetActiveDevices(count int) {
	activeDevices.Set(float64(count))
}
