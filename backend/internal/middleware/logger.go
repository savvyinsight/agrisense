package middleware

import (
    "time"

    "github.com/gin-gonic/gin"
    "github.com/sirupsen/logrus"
)

var log = logrus.New()

func init() {
    log.SetFormatter(&logrus.JSONFormatter{})
    log.SetLevel(logrus.InfoLevel)
}

func LoggerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        c.Next()
        
        log.WithFields(logrus.Fields{
            "method":     c.Request.Method,
            "path":       c.FullPath(),
            "status":     c.Writer.Status(),
            "duration":   time.Since(start),
            "client_ip":  c.ClientIP(),
            "user_id":    c.GetInt("user_id"),
        }).Info("HTTP request")
    }
}

func GetLogger() *logrus.Logger {
    return log
}
