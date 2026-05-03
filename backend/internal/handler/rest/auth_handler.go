package rest

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "github.com/savvyinsight/agrisenseiot/internal/service/auth"
)

type AuthHandler struct {
    authService *auth.Service
}

func NewAuthHandler(authService *auth.Service) *AuthHandler {
    return &AuthHandler{
        authService: authService,
    }
}

func (h *AuthHandler) Register(c *gin.Context) {
    var req auth.RegisterRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.authService.Register(req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) Login(c *gin.Context) {
    var req auth.LoginRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    response, err := h.authService.Login(req)
    if err != nil {
        c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, response)
}
