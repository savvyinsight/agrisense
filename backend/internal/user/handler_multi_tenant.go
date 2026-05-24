package user

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// UserHandler handles user and account management endpoints
type UserHandler struct {
	UserRepo       UserRepository
	AccountRepo    AccountRepository
	PermissionRepo PermissionRepository
	InvitationRepo InvitationRepository
	AuditRepo      AuditLogRepository
}

// Request/Response DTOs
type CreateAccountRequest struct {
	Name             string `json:"name"`
	SubscriptionTier string `json:"subscription_tier"`
}

type InviteUserRequest struct {
	Email  string `json:"email"`
	Role   string `json:"role"`
	FarmID *int   `json:"farm_id"`
}

type UpdatePermissionRequest struct {
	Role string `json:"role"`
}

type GetTeamResponse struct {
	Users       []UserWithPermissions `json:"users"`
	Invitations []UserInvitation      `json:"invitations"`
}

type UserWithPermissions struct {
	ID          int              `json:"id"`
	Email       string           `json:"email"`
	Username    string           `json:"username"`
	Permissions []UserPermission `json:"permissions"`
	CreatedAt   time.Time        `json:"created_at"`
}

// InviteUserHandler invites a new user to the account
// POST /api/v1/accounts/:id/users/invite
func (h *UserHandler) InviteUserHandler(c *gin.Context) {
	// Get user from JWT (set by AuthMiddleware)
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	usr := userI.(*User)

	accountIDStr := c.Param("id")
	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	// Check permission: only account_owner or farm_manager can invite
	hasPermission, err := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if err == nil && !hasPermission {
		hasPermission, _ = h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleFarmManager)
	}
	if err != nil || !hasPermission {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only account owners and managers can invite users"})
		return
	}

	var req InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Generate invitation token
	token := generateInvitationToken()

	invitation := &UserInvitation{
		AccountID:       accountID,
		Email:           req.Email,
		Role:            req.Role,
		FarmID:          req.FarmID,
		InvitationToken: token,
		InvitedByID:     usr.ID,
		ExpiresAt:       time.Now().Add(7 * 24 * time.Hour), // 7-day expiration
	}

	if err := h.InvitationRepo.CreateInvitation(invitation); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to create invitation: %v", err)})
		return
	}

	// Log action
	_ = h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "create",
		ResourceType: "user_invitation",
		ResourceID:   fmt.Sprintf("%d", invitation.ID),
		ResourceName: invitation.Email,
		Status:       "success",
	})

	c.JSON(http.StatusCreated, invitation)
}

// ListTeamHandler lists all users in an account
// GET /api/v1/accounts/:id/users
func (h *UserHandler) ListTeamHandler(c *gin.Context) {
	accountIDStr := c.Param("id")
	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	// Get all users in account (limit/offset from query params)
	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	users, _, err := h.UserRepo.GetByAccountID(accountID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list users: %v", err)})
		return
	}

	// Enrich users with permissions
	var enrichedUsers []UserWithPermissions
	for _, u := range users {
		perms, err := h.PermissionRepo.GetPermissionsByUserID(u.ID, accountID)
		if err != nil {
			perms = []UserPermission{}
		}

		enrichedUsers = append(enrichedUsers, UserWithPermissions{
			ID:          u.ID,
			Email:       u.Email,
			Username:    u.Username,
			Permissions: perms,
			CreatedAt:   u.CreatedAt,
		})
	}

	// Get pending invitations
	invitations, err := h.InvitationRepo.ListPendingInvitations(accountID)
	if err != nil {
		invitations = []UserInvitation{}
	}

	response := GetTeamResponse{
		Users:       enrichedUsers,
		Invitations: invitations,
	}

	c.JSON(http.StatusOK, response)
}

// UpdateUserPermissionHandler updates a user's role
// PUT /api/v1/accounts/:id/users/:uid/permission
func (h *UserHandler) UpdateUserPermissionHandler(c *gin.Context) {
	// Get user from JWT
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	usr := userI.(*User)

	accountIDStr := c.Param("id")
	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	// Check permission: only account_owner can update permissions
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only account owners can update permissions"})
		return
	}

	// Extract permission ID from query or body
	permIDStr := c.Query("permission_id")
	if permIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permission ID required"})
		return
	}

	permID, err := strconv.Atoi(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	var req UpdatePermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get existing permission for logging
	perms, _ := h.PermissionRepo.GetPermissionsByUserID(usr.ID, accountID)
	var oldRole string
	for _, p := range perms {
		if p.ID == permID {
			oldRole = p.Role
			break
		}
	}

	perm := &UserPermission{
		ID:   permID,
		Role: req.Role,
	}

	if err := h.PermissionRepo.UpdatePermission(perm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update permission: %v", err)})
		return
	}

	// Log action
	_ = h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "update",
		ResourceType: "user_permission",
		ResourceID:   fmt.Sprintf("%d", permID),
		OldValues:    map[string]interface{}{"role": oldRole},
		NewValues:    map[string]interface{}{"role": req.Role},
		Status:       "success",
	})

	c.JSON(http.StatusOK, perm)
}

// RevokeUserHandler revokes user access from account
// DELETE /api/v1/accounts/:id/users/:uid
func (h *UserHandler) RevokeUserHandler(c *gin.Context) {
	// Get user from JWT
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	usr := userI.(*User)

	accountIDStr := c.Param("id")
	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	// Check permission: only account_owner can revoke
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only account owners can revoke access"})
		return
	}

	permIDStr := c.Query("permission_id")
	if permIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permission ID required"})
		return
	}

	permID, err := strconv.Atoi(permIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid permission ID"})
		return
	}

	if err := h.PermissionRepo.RevokePermission(permID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to revoke permission: %v", err)})
		return
	}

	// Log action
	_ = h.LogAuditAction(&AuditLog{
		AccountID:    accountID,
		UserID:       &usr.ID,
		Action:       "delete",
		ResourceType: "user_permission",
		ResourceID:   fmt.Sprintf("%d", permID),
		Status:       "success",
	})

	c.Status(http.StatusNoContent)
}

// GetAuditLogHandler retrieves audit logs for account
// GET /api/v1/accounts/:id/audit?resource_type=user&action=create
func (h *UserHandler) GetAuditLogHandler(c *gin.Context) {
	// Get user from JWT
	userI, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	usr := userI.(*User)

	accountIDStr := c.Param("id")
	accountID, err := strconv.Atoi(accountIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid account ID"})
		return
	}

	// Check permission: only account_owner can view audit logs
	hasPermission, _ := h.PermissionRepo.HasPermission(usr.ID, accountID, nil, RoleAccountOwner)
	if !hasPermission {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only account owners can view audit logs"})
		return
	}

	// Parse pagination
	limit := 50
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	// Parse filters
	filters := map[string]interface{}{}
	if resourceType := c.Query("resource_type"); resourceType != "" {
		filters["resource_type"] = resourceType
	}
	if action := c.Query("action"); action != "" {
		filters["action"] = action
	}

	logs, total, err := h.AuditRepo.GetAuditLogs(accountID, filters, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to retrieve audit logs: %v", err)})
		return
	}

	response := map[string]interface{}{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	}

	c.JSON(http.StatusOK, response)
}

// Helper functions

// generateInvitationToken creates a secure random token for invitations
func generateInvitationToken() string {
	bytes := make([]byte, 32)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// LogAuditAction logs an action to the audit log
func (h *UserHandler) LogAuditAction(log *AuditLog) error {
	if log.AccountID == 0 || h.AuditRepo == nil {
		return fmt.Errorf("missing account_id or audit repo")
	}

	if log.CreatedAt.IsZero() {
		log.CreatedAt = time.Now()
	}

	return h.AuditRepo.LogAction(log)
}
