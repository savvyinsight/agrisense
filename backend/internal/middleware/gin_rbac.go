package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/savvyinsight/agrisense/internal/user"
)

// GinRequireRole returns a Gin middleware that checks if the authenticated user
// has one of the specified roles in their account's user_permissions table.
// It reads user_id and account_id from the Gin context (set by AuthMiddleware).
func GinRequireRole(permRepo user.PermissionRepository, roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := MustGetUserID(c)
		if !ok {
			return
		}

		accountID, ok := MustGetAccountID(c)
		if !ok {
			return
		}

		// Check if user has any of the required roles
		for _, role := range roles {
			hasPermission, err := permRepo.HasPermission(userID, accountID, nil, role)
			if err == nil && hasPermission {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "Insufficient permissions",
		})
	}
}
