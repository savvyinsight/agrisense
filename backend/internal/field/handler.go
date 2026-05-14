package field

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type FieldHandler struct {
	repo FieldRepository
}

func NewFieldHandler(repo FieldRepository) *FieldHandler {
	return &FieldHandler{repo: repo}
}

func (h *FieldHandler) Create(c *gin.Context) {
	var field Field
	if err := c.ShouldBindJSON(&field); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	field.UserID = userID.(int)
	field.Health = FieldHealthHealthy

	if err := h.repo.Create(&field); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, field)
}

func (h *FieldHandler) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field id"})
		return
	}

	field, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "field not found"})
		return
	}

	c.JSON(http.StatusOK, field)
}

func (h *FieldHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")

	fields, err := h.repo.List(userID.(int))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if fields == nil {
		fields = []Field{}
	}

	c.JSON(http.StatusOK, gin.H{"data": fields, "total": len(fields)})
}

func (h *FieldHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field id"})
		return
	}

	existing, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "field not found"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if v, ok := updates["name"]; ok { existing.Name = v.(string) }
	if v, ok := updates["crop"]; ok {
		s := v.(string)
		existing.Crop = &s
	}
	if v, ok := updates["area_hectares"]; ok {
		f := v.(float64)
		existing.AreaHectares = &f
	}
	if v, ok := updates["health"]; ok { existing.Health = FieldHealth(v.(string)) }
	if v, ok := updates["soil_moisture"]; ok {
		f := v.(float64)
		existing.SoilMoisture = &f
	}
	if v, ok := updates["temperature"]; ok {
		f := v.(float64)
		existing.Temperature = &f
	}
	if v, ok := updates["humidity"]; ok {
		f := v.(float64)
		existing.Humidity = &f
	}

	if err := h.repo.Update(existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, existing)
}

func (h *FieldHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field id"})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
