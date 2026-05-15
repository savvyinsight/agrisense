package user

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// AccountListItem is an account with owner name and counts for the admin list view
type AccountListItem struct {
	ID              int    `json:"id"`
	Name            string `json:"name"`
	SubscriptionTier string `json:"subscription_tier"`
	OwnerID         int    `json:"owner_id"`
	OwnerName       string `json:"owner_name"`
	UserCount       int64  `json:"user_count"`
	DeviceCount     int64  `json:"device_count"`
	IsActive        bool   `json:"is_active"`
	CreatedAt       string `json:"created_at"`
}

// AdminHandler handles platform admin endpoints
type AdminHandler struct {
	UserRepo       UserRepository
	AccountRepo    AccountRepository
	PermissionRepo PermissionRepository
	DB             *sql.DB
}

// ListAccountsHandler returns all accounts with user/device counts
// GET /api/v1/admin/accounts?page=1&limit=20
func (h *AdminHandler) ListAccountsHandler(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	accounts, total, err := h.AccountRepo.ListAllAccounts(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list accounts"})
		return
	}

	var items []AccountListItem
	for _, a := range accounts {
		ownerName := ""
		if owner, err := h.UserRepo.GetByID(a.OwnerID); err == nil {
			ownerName = owner.Username
		}
		userCount, _ := h.AccountRepo.GetUserCountByAccount(a.ID)
		deviceCount, _ := h.AccountRepo.GetDeviceCountByAccount(a.ID)

		items = append(items, AccountListItem{
			ID:               a.ID,
			Name:             a.Name,
			SubscriptionTier: a.SubscriptionTier,
			OwnerID:          a.OwnerID,
			OwnerName:        ownerName,
			UserCount:        userCount,
			DeviceCount:      deviceCount,
			IsActive:         a.IsActive,
			CreatedAt:        a.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"accounts": items,
		"total":    total,
		"page":     page,
		"limit":    limit,
	})
}

// GetAccountDetailHandler returns a single account with all users and devices
// GET /api/v1/admin/accounts/:id
func (h *AdminHandler) GetAccountDetailHandler(c *gin.Context) {
	idStr := c.Param("id")
	accountID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	account, err := h.AccountRepo.GetAccountByID(accountID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Account not found"})
		return
	}

	users, _, err := h.UserRepo.GetByAccountID(accountID, 100, 0)
	if err != nil {
		users = []User{}
	}

	type userWithRole struct {
		ID        int    `json:"id"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Role      string `json:"role"`
		CreatedAt string `json:"created_at"`
	}

	var enrichedUsers []userWithRole
	for _, u := range users {
		perms, _ := h.PermissionRepo.GetPermissionsByUserID(u.ID, accountID)
		role := u.Role
		if len(perms) > 0 {
			role = perms[0].Role
		}
		enrichedUsers = append(enrichedUsers, userWithRole{
			ID:        u.ID,
			Username:  u.Username,
			Email:     u.Email,
			Role:      role,
			CreatedAt: u.CreatedAt.Format("2006-01-02T15:04:05Z"),
		})
	}

	type deviceItem struct {
		ID       int    `json:"id"`
		DeviceID string `json:"device_id"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		Status   string `json:"status"`
	}

	var devices []deviceItem
	rows, err := h.DB.Query(
		`SELECT id, device_id, name, device_type, status FROM devices WHERE account_id = $1 ORDER BY created_at DESC`,
		accountID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d deviceItem
			if err := rows.Scan(&d.ID, &d.DeviceID, &d.Name, &d.Type, &d.Status); err == nil {
				devices = append(devices, d)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"account": gin.H{
			"id":                account.ID,
			"name":              account.Name,
			"subscription_tier": account.SubscriptionTier,
			"owner_id":          account.OwnerID,
			"is_active":         account.IsActive,
			"user_count":        len(enrichedUsers),
			"device_count":      len(devices),
			"created_at":        account.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		"users":   enrichedUsers,
		"devices": devices,
	})
}

// GetPlatformStatsHandler returns global platform statistics
// GET /api/v1/admin/stats
func (h *AdminHandler) GetPlatformStatsHandler(c *gin.Context) {
	var totalAccounts, totalUsers, totalDevices int64

	h.DB.QueryRow(`SELECT COUNT(*) FROM accounts WHERE is_active = TRUE`).Scan(&totalAccounts)
	h.DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&totalUsers)
	h.DB.QueryRow(`SELECT COUNT(*) FROM devices`).Scan(&totalDevices)

	c.JSON(http.StatusOK, gin.H{
		"total_accounts": totalAccounts,
		"total_users":    totalUsers,
		"total_devices":  totalDevices,
	})
}
