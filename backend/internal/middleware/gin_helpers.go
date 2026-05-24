package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/user"
)

// GetUserID extracts user ID from Gin context (set by AuthMiddleware).
func GetUserID(c *gin.Context) (int, error) {
	val, exists := c.Get("user_id")
	if !exists {
		return 0, fmt.Errorf("user_id not found in context")
	}
	id, ok := val.(int)
	if !ok {
		return 0, fmt.Errorf("invalid user_id in context")
	}
	return id, nil
}

// GetAccountID extracts account ID from Gin context (set by AuthMiddleware).
func GetAccountID(c *gin.Context) (int, error) {
	val, exists := c.Get("account_id")
	if !exists || val == nil {
		return 0, fmt.Errorf("account_id not found in context")
	}
	id, ok := val.(int)
	if !ok {
		return 0, fmt.Errorf("invalid account_id in context")
	}
	return id, nil
}

// GetUserRole extracts user role from Gin context (set by AuthMiddleware).
func GetUserRole(c *gin.Context) (string, error) {
	val, exists := c.Get("user_role")
	if !exists {
		return "", fmt.Errorf("user_role not found in context")
	}
	role, ok := val.(string)
	if !ok {
		return "", fmt.Errorf("invalid user_role in context")
	}
	return role, nil
}

// GetUser extracts the full User object from Gin context (set by AuthMiddleware).
func GetUser(c *gin.Context) (*user.User, error) {
	val, exists := c.Get("user")
	if !exists {
		return nil, fmt.Errorf("user not found in context")
	}
	usr, ok := val.(*user.User)
	if !ok {
		return nil, fmt.Errorf("invalid user in context")
	}
	return usr, nil
}

// MustGetAccountID extracts account ID from Gin context, aborts with 403 if missing.
// Use this in handlers that require an account context.
func MustGetAccountID(c *gin.Context) (int, bool) {
	id, err := GetAccountID(c)
	if err != nil {
		c.AbortWithStatusJSON(403, gin.H{"error": "Account access required"})
		return 0, false
	}
	return id, true
}

// MustGetUserID extracts user ID from Gin context, aborts with 401 if missing.
func MustGetUserID(c *gin.Context) (int, bool) {
	id, err := GetUserID(c)
	if err != nil {
		c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
		return 0, false
	}
	return id, true
}
