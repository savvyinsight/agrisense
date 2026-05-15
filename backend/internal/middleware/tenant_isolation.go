package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/savvyinsight/agrisense/internal/user"
)

const (
	// Context keys
	ContextKeyUser      = "user"
	ContextKeyAccountID = "account_id"
	ContextKeyFarmID    = "farm_id"
	ContextKeyIPAddress = "ip_address"
)

// TenantIsolationMiddleware ensures that all requests have account_id and enforces row-level security
// This middleware MUST be applied to all protected routes
func TenantIsolationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract user from context (should be set by auth middleware)
		ctx := r.Context()
		userAny := ctx.Value(ContextKeyUser)
		if userAny == nil {
			http.Error(w, "User not found in context", http.StatusUnauthorized)
			return
		}

		usr, ok := userAny.(*user.User)
		if !ok {
			http.Error(w, "Invalid user in context", http.StatusUnauthorized)
			return
		}

		// User MUST have an account_id
		if usr.AccountID == nil {
			http.Error(w, "User account not found", http.StatusForbidden)
			return
		}

		// Check if request is trying to access a different account
		requestAccountID := r.URL.Query().Get("account_id")
		if requestAccountID != "" {
			reqAccountIDInt, err := strconv.Atoi(requestAccountID)
			if err != nil {
				http.Error(w, "Invalid account_id", http.StatusBadRequest)
				return
			}

			// Enforce tenant isolation: user can only access their own account
			if reqAccountIDInt != *usr.AccountID {
				http.Error(w, "Forbidden: Cannot access another account's data", http.StatusForbidden)
				return
			}
		}

		// Store user and account info in context for handlers
		ctx = context.WithValue(ctx, ContextKeyUser, usr)
		ctx = context.WithValue(ctx, ContextKeyAccountID, *usr.AccountID)

		// Extract farm_id if present
		farmIDStr := r.URL.Query().Get("farm_id")
		if farmIDStr != "" {
			farmID, err := strconv.Atoi(farmIDStr)
			if err == nil {
				ctx = context.WithValue(ctx, ContextKeyFarmID, farmID)
			}
		}

		// Store IP address for audit logging
		ipAddress := getClientIP(r)
		ctx = context.WithValue(ctx, ContextKeyIPAddress, ipAddress)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// PermissionCheckMiddleware checks if user has required role
// Usage: PermissionCheckMiddleware([]string{"account_owner", "farm_manager"})(next)
func PermissionCheckMiddleware(requiredRoles []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract user and account from context
			ctx := r.Context()
			userAny := ctx.Value(ContextKeyUser)
			if userAny == nil {
				http.Error(w, "User not found in context", http.StatusUnauthorized)
				return
			}

			usr, ok := userAny.(*user.User)
			if !ok {
				http.Error(w, "Invalid user in context", http.StatusUnauthorized)
				return
			}

			// Check if user has one of the required roles
			// This should be checked against UserPermission table
			// For now, check legacy role field as fallback
			hasPermission := false
			for _, role := range requiredRoles {
				if usr.Role == role || 
					(usr.Role == "admin" && (role == "account_owner" || role == "farm_manager")) ||
					(usr.Role == "viewer" && role == "operator") {
					hasPermission = true
					break
				}
			}

			if !hasPermission {
				http.Error(w, fmt.Sprintf("Forbidden: Required roles: %s", strings.Join(requiredRoles, ", ")), http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// getClientIP extracts client IP from request
func getClientIP(r *http.Request) string {
	// Try X-Forwarded-For header first (proxy)
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		// X-Forwarded-For can contain multiple IPs; get the first one
		ips := strings.Split(forwarded, ",")
		return strings.TrimSpace(ips[0])
	}

	// Try X-Real-IP header
	if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
		return realIP
	}

	// Fallback to RemoteAddr
	return r.RemoteAddr
}

// RequiresAuth is a simple auth check middleware
func RequiresAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		userAny := ctx.Value(ContextKeyUser)
		if userAny == nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		_, ok := userAny.(*user.User)
		if !ok {
			http.Error(w, "Invalid user in context", http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// GetUserFromContext extracts user from request context
func GetUserFromContext(r *http.Request) (*user.User, error) {
	userAny := r.Context().Value(ContextKeyUser)
	if userAny == nil {
		return nil, fmt.Errorf("user not found in context")
	}

	usr, ok := userAny.(*user.User)
	if !ok {
		return nil, fmt.Errorf("invalid user in context")
	}

	return usr, nil
}

// GetAccountIDFromContext extracts account ID from request context
func GetAccountIDFromContext(r *http.Request) (int, error) {
	accountIDVal := r.Context().Value(ContextKeyAccountID)
	if accountIDVal == nil {
		return 0, fmt.Errorf("account_id not found in context")
	}

	accountID, ok := accountIDVal.(int)
	if !ok {
		return 0, fmt.Errorf("invalid account_id in context")
	}

	return accountID, nil
}

// GetFarmIDFromContext extracts farm ID from request context (if present)
func GetFarmIDFromContext(r *http.Request) (int, error) {
	farmIDVal := r.Context().Value(ContextKeyFarmID)
	if farmIDVal == nil {
		return 0, fmt.Errorf("farm_id not found in context")
	}

	farmID, ok := farmIDVal.(int)
	if !ok {
		return 0, fmt.Errorf("invalid farm_id in context")
	}

	return farmID, nil
}

// GetIPAddressFromContext extracts IP address from request context
func GetIPAddressFromContext(r *http.Request) string {
	ipVal := r.Context().Value(ContextKeyIPAddress)
	if ipVal == nil {
		return ""
	}

	ip, ok := ipVal.(string)
	if !ok {
		return ""
	}

	return ip
}
