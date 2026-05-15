package user

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AccountListItem is an account with owner name and counts for the admin list view
type AccountListItem struct {
	ID               int    `json:"id"`
	Name             string `json:"name"`
	SubscriptionTier string `json:"subscription_tier"`
	OwnerID          *int   `json:"owner_id"`
	OwnerName        string `json:"owner_name"`
	UserCount        int64  `json:"user_count"`
	DeviceCount      int64  `json:"device_count"`
	MaxUsers         *int   `json:"max_users"`
	MaxDevices       *int   `json:"max_devices"`
	IsActive         bool   `json:"is_active"`
	CreatedAt        string `json:"created_at"`
}

// AdminHandler handles platform admin endpoints
type AdminHandler struct {
	UserRepo       UserRepository
	AccountRepo    AccountRepository
	PermissionRepo PermissionRepository
	AuditRepo      AuditLogRepository
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
		c.JSON(http.StatusInternalServerError, gin.H	{"error": "Failed to list accounts"})
		return
	}

	var items []AccountListItem
	for _, a := range accounts {
		ownerName := ""
		if a.OwnerID != nil {
			if owner, err := h.UserRepo.GetByID(*a.OwnerID); err == nil {
				ownerName = owner.Username
			}
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
			MaxUsers:         a.MaxUsers,
			MaxDevices:       a.MaxDevices,
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
		`SELECT id, device_id, name, type, status FROM devices WHERE account_id = $1 ORDER BY created_at DESC`,
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
			"max_users":         account.MaxUsers,
			"max_devices":       account.MaxDevices,
			"user_count":        len(enrichedUsers),
			"device_count":      len(devices),
			"created_at":        account.CreatedAt.Format("2006-01-02T15:04:05Z"),
		},
		"users":   enrichedUsers,
		"devices": devices,
	})
}

// UpdateAccountRequest is the request body for updating an account
type UpdateAccountRequest struct {
	Name             *string `json:"name,omitempty"`
	SubscriptionTier *string `json:"subscription_tier,omitempty"`
	IsActive         *bool   `json:"is_active,omitempty"`
	MaxUsers         *int    `json:"max_users,omitempty"`
	MaxDevices       *int    `json:"max_devices,omitempty"`
}

// UpdateAccountHandler updates an account's settings
// PATCH /api/v1/admin/accounts/:id
func (h *AdminHandler) UpdateAccountHandler(c *gin.Context) {
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

	var req UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.Name != nil {
		account.Name = *req.Name
	}
	if req.SubscriptionTier != nil {
		account.SubscriptionTier = *req.SubscriptionTier
		// Reset limits to tier defaults when tier changes
		defaultMax := tierDefaultMaxUsers(*req.SubscriptionTier)
		account.MaxUsers = &defaultMax
		defaultDev := tierDefaultMaxDevices(*req.SubscriptionTier)
		account.MaxDevices = &defaultDev
	}
	if req.IsActive != nil {
		account.IsActive = *req.IsActive
	}
	if req.MaxUsers != nil {
		account.MaxUsers = req.MaxUsers
	}
	if req.MaxDevices != nil {
		account.MaxDevices = req.MaxDevices
	}

	if err := h.AccountRepo.UpdateAccount(account); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update account"})
		return
	}

	// Re-fetch to get updated timestamps
	account, _ = h.AccountRepo.GetAccountByID(accountID)

	// Log audit
	rawUID, _ := c.Get("user_id")
	uid, uidOK := rawUID.(int)
	if h.AuditRepo != nil && uidOK && uid > 0 {
		err := h.AuditRepo.LogAction(&AuditLog{
			AccountID:    accountID,
			UserID:       &uid,
			Action:       "update",
			ResourceType: "account",
			ResourceID:   fmt.Sprintf("%d", accountID),
			ResourceName: account.Name,
			Status:       "success",
		})
		if err != nil {
			fmt.Printf("AUDIT ERROR: %v\n", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                account.ID,
		"name":              account.Name,
		"subscription_tier": account.SubscriptionTier,
		"is_active":         account.IsActive,
		"max_users":         account.MaxUsers,
		"max_devices":       account.MaxDevices,
	})
}

// CreateUserInAccountHandler creates a new user in the specified account
// POST /api/v1/admin/accounts/:id/users
func (h *AdminHandler) CreateUserInAccountHandler(c *gin.Context) {
	idStr := c.Param("id")
	accountID, err := strconv.Atoi(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	var req struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Check quota
	if repo, ok := h.AccountRepo.(*PostgresAccountRepository); ok {
		if err := repo.CheckUserQuota(accountID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	aid := accountID
	user := &User{
		Username:  req.Username,
		Email:     req.Email,
		Password:  string(hashed),
		Role:      req.Role,
		AccountID: &aid,
	}

	if err := h.UserRepo.Create(user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	perm := &UserPermission{
		UserID:    user.ID,
		AccountID: accountID,
		FarmID:    nil,
		Role:      req.Role,
		GrantedBy: 0, // system
	}
	_ = h.PermissionRepo.CreatePermission(perm)

	// Log audit
	userID, _ := c.Get("user_id")
	uid, uidOK := userID.(int)
	if h.AuditRepo != nil && uidOK && uid > 0 {
		err := h.AuditRepo.LogAction(&AuditLog{
			AccountID:    accountID,
			UserID:       &uid,
			Action:       "create",
			ResourceType: "user",
			ResourceID:   fmt.Sprintf("%d", user.ID),
			ResourceName: req.Username,
			Status:       "success",
		})
		if err != nil {
			fmt.Printf("AUDIT ERROR: %v\n", err)
		}
	}

	user.Password = ""
	c.JSON(http.StatusCreated, user)
}

// RemoveUserFromAccountHandler removes a user from an account
// DELETE /api/v1/admin/accounts/:id/users/:uid
func (h *AdminHandler) RemoveUserFromAccountHandler(c *gin.Context) {
	accountID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}
	userID, err := strconv.Atoi(c.Param("uid"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var removedUser *User
	removedUser, _ = h.UserRepo.GetByID(userID)
	removedName := ""
	if removedUser != nil {
		removedName = removedUser.Username
	}

	perms, err := h.PermissionRepo.GetPermissionsByUserID(userID, accountID)
	if err == nil {
		for _, p := range perms {
			_ = h.PermissionRepo.RevokePermission(p.ID)
		}
	}

	// Log audit
	actingUserID, _ := c.Get("user_id")
	uid, uidOK := actingUserID.(int)
	if h.AuditRepo != nil && uidOK && uid > 0 {
		err := h.AuditRepo.LogAction(&AuditLog{
			AccountID:    accountID,
			UserID:       &uid,
			Action:       "delete",
			ResourceType: "user",
			ResourceID:   fmt.Sprintf("%d", userID),
			ResourceName: removedName,
			Status:       "success",
		})
		if err != nil {
			fmt.Printf("AUDIT ERROR: %v\n", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "removed"})
}

// GetGlobalAuditLogHandler returns audit logs across all accounts
// GET /api/v1/admin/audit?page=1&limit=25&resource_type=user&action=create
func (h *AdminHandler) GetGlobalAuditLogHandler(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit < 1 || limit > 100 {
		limit = 25
	}

	filters := map[string]interface{}{}
	if rt := c.Query("resource_type"); rt != "" {
		filters["resource_type"] = rt
	}
	if a := c.Query("action"); a != "" {
		filters["action"] = a
	}
	if aid := c.Query("account_id"); aid != "" {
		if id, err := strconv.Atoi(aid); err == nil {
			filters["account_id"] = id
		}
	}

	logs, total, err := h.AuditRepo.GetAllAuditLogs(filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":  logs,
		"total": total,
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
