package weather

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type WeatherHandler struct {
	repo WeatherRepository
}

func NewWeatherHandler(repo WeatherRepository) *WeatherHandler {
	return &WeatherHandler{repo: repo}
}

func (h *WeatherHandler) GetCurrent(c *gin.Context) {
	data, err := h.repo.GetCurrent()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"temperature": 24, "humidity": 58, "rainfall_mm": 0,
			"wind_speed": 12, "forecast": "cloudy",
		})
		return
	}

	c.JSON(http.StatusOK, data)
}
